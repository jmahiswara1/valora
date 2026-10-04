import { Injectable, HttpStatus } from '@nestjs/common';
import { secret } from '../../infrastructure/config.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { StorageService } from '../../infrastructure/storage.service.js';
import type { MediaTicketInput } from '@valora/contracts';
import { serial } from '../../shared/transactions.js';
import { AppException } from '../../shared/http.js';
import sharp from 'sharp';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';

const maxBytes = 8 * 1024 * 1024;

const maxPixels = 20_000_000;

const mimeForFormat: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

@Injectable()
export class MediaService {
  private readonly signingKey = secret('MEDIA_SIGNING_KEY');

  constructor(private readonly db: DatabaseService, private readonly storage: StorageService) {}

  async ticket(userId: string, input: MediaTicketInput, itemId?: string, caseId?: string, correctionCaseId?: string): Promise<{ ticketId: string; uploadUrl: string; expiresAt: string }> {
    return serial(this.db, async (tx) => {
    if (input.purpose === 'CASE_EVIDENCE' && !caseId && !correctionCaseId) throw new AppException(400, 'MEDIA_INVALID', 'Bukti kasus memerlukan tiket dari kasus terkait.');
    if (input.purpose === 'REPAIR_EVIDENCE' && !itemId) throw new AppException(400, 'MEDIA_INVALID', 'Bukti Repair harus terkait Item.');
    if (itemId && !caseId && !correctionCaseId) {
      const item = await tx.item.findFirst({ where: { id: itemId, currentOwnerId: userId, archivedAt: null }, include: { media: { where: { deletedAt: null, repairRecordId: null, caseId: null, OR: [{ uploadedById: userId }, { shareWithFutureOwner: true }] } } } });
      if (!item) throw new AppException(404, 'NOT_FOUND', 'Item tidak ditemukan.');
      if (item.reservedByTransactionId) throw new AppException(409, 'ITEM_RESERVED', 'Item sedang dalam kesepakatan.');
      if (input.purpose === 'ITEM' && item.media.length >= 8) throw new AppException(400, 'MEDIA_INVALID', 'Maksimal delapan foto per Item.');
    }
    const created = await tx.uploadTicket.create({ data: {
      userId, itemId, caseId, correctionCaseId, purpose: input.purpose, fileName: input.fileName, declaredMime: input.mime, declaredBytes: input.bytes,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    } });
    return { ticketId: created.id, uploadUrl: '/api/v1/media/uploads/' + created.id, expiresAt: created.expiresAt.toISOString() };
    });
  }

  async upload(userId: string, ticketId: string, body: unknown, contentType: string | undefined): Promise<{ ticketId: string; mime: 'image/webp'; bytes: number }> {
    const ticket = await this.db.uploadTicket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.userId !== userId) throw new AppException(404, 'NOT_FOUND', 'Tiket unggah tidak ditemukan.');
    if (ticket.status !== 'ISSUED' || ticket.expiresAt <= new Date()) throw new AppException(409, 'STATE_CONFLICT', 'Tiket unggah tidak berlaku.');
    if (!Buffer.isBuffer(body) || body.length < 1 || body.length > maxBytes || body.length !== ticket.declaredBytes) throw new AppException(400, 'MEDIA_INVALID', 'Ukuran foto tidak sesuai atau melebihi 8 MiB.');
    if (contentType?.split(';')[0] !== ticket.declaredMime) throw new AppException(400, 'MEDIA_INVALID', 'Jenis berkas tidak sesuai tiket.');
    let processed: Buffer;
    try {
      const image = sharp(body, { failOn: 'error', limitInputPixels: maxPixels });
      const metadata = await image.metadata();
      if (!metadata.format || mimeForFormat[metadata.format] !== ticket.declaredMime || !metadata.width || !metadata.height || metadata.width * metadata.height > maxPixels) {
        throw new Error('Invalid format or dimensions');
      }
      processed = await image.rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch {
      throw new AppException(400, 'MEDIA_INVALID', 'Isi berkas bukan foto JPEG, PNG, atau WebP yang valid.');
    }
    const storageKey = ticket.id + '.webp';
    await this.storage.write(storageKey, processed);
    const changed = await serial(this.db, (tx) => tx.uploadTicket.updateMany({
      where: { id: ticket.id, status: 'ISSUED', expiresAt: { gt: new Date() } },
      data: { status: 'UPLOADED', actualMime: 'image/webp', actualBytes: processed.length, storageKey, uploadedAt: new Date() },
    })).catch(async (error: unknown) => { await this.db.storageDeletion.upsert({ where: { storageKey }, update: {}, create: { storageKey } }); throw error; });
    if (changed.count !== 1) {
      await this.storage.remove(storageKey);
      throw new AppException(409, 'STATE_CONFLICT', 'Tiket unggah tidak berlaku.');
    }
    return { ticketId: ticket.id, mime: 'image/webp', bytes: processed.length };
  }

  async access(userId: string, mediaId: string): Promise<{ url: string; expiresAt: string }> {
    await this.authorized(userId, mediaId);
    const expires = Date.now() + 5 * 60 * 1000;
    const signature = this.sign(mediaId, userId, expires);
    return { url: '/api/v1/media/private/' + mediaId + '?expires=' + expires + '&signature=' + signature, expiresAt: new Date(expires).toISOString() };
  }

  private sign(mediaId: string, userId: string, expires: number): string {
    return createHmac('sha256', this.signingKey).update(mediaId + ':' + userId + ':' + expires).digest('hex');
  }

  private async authorized(userId: string, mediaId: string) {
    const media = await this.db.mediaAsset.findFirst({ where: { id: mediaId, deletedAt: null }, include: { item: true, repairRecord: true } });
    if (!media) throw new AppException(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
    if (media.caseId) {
      const record = await this.db.disputeCase.findUnique({ where: { id: media.caseId }, include: { transaction: true } });
      if (record && [record.transaction.sellerOrDonorId, record.transaction.buyerOrRecipientId].includes(userId)) return media;
      if (record?.assignedAdminId === userId && await this.db.user.findFirst({ where: { id: userId, role: 'ADMIN', status: 'ACTIVE' } }) && await this.db.caseAccessGrant.findFirst({ where: { caseId: media.caseId, adminId: userId, kind: 'EVIDENCE', expiresAt: { gt: new Date() } } })) return media;
      throw new AppException(404, 'NOT_FOUND', 'Foto bukti tidak ditemukan.');
    }
    if (media.item.archivedAt) throw new AppException(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
    const admin = await this.db.user.findFirst({ where: { id: userId, role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    if (admin && !media.repairRecordId) {
      const pendingReview = await this.db.listingRevisionMedia.findFirst({ where: { mediaId, revision: { listing: { status: 'PENDING_REVIEW', currentRevisionId: { not: null } } } }, include: { revision: { include: { listing: true } } } });
      if (pendingReview && pendingReview.revision.listing.currentRevisionId === pendingReview.revisionId) return media;
    }
    if (media.repairRecordId) {
      if (media.uploadedById !== userId && !(media.item.currentOwnerId === userId && media.repairRecord?.status === 'VALID' && media.repairRecord.shareDetailsWithFutureOwner && media.shareWithFutureOwner)) throw new AppException(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
    } else if (media.uploadedById !== userId && !(media.item.currentOwnerId === userId && media.shareWithFutureOwner)) {
      const transactions = await this.db.transaction.findMany({ where: { OR: [{ sellerOrDonorId: userId }, { buyerOrRecipientId: userId }], AND: [{ OR: [{ itemId: media.itemId }, { offeredItemId: media.itemId }] }] }, select: { snapshot: true } });
      const acceptedPhoto = transactions.some((t) => (t.snapshot as unknown as { items: { mediaIds: string[] }[] }).items.some((i) => i.mediaIds.includes(mediaId)));
      const offers = acceptedPhoto ? [] : await this.db.offer.findMany({ where: { exchangeItemId: media.itemId, OR: [{ bidderId: userId }, { listing: { ownerId: userId } }] }, select: { exchangeSnapshot: true } });
      if (!acceptedPhoto && !offers.some((o) => (o.exchangeSnapshot as unknown as { mediaIds?: string[] } | null)?.mediaIds?.includes(mediaId))) throw new AppException(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
    }
    return media;
  }

  async privatePhoto(userId: string, mediaId: string, expiresText: string, signature: string, response: Response): Promise<void> {
    const expires = Number(expiresText);
    if (!Number.isSafeInteger(expires) || expires < Date.now() || expires > Date.now() + 5 * 60 * 1000 || !/^[a-f0-9]{64}$/.test(signature)) {
      throw new AppException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Tautan foto sudah tidak berlaku.');
    }
    const expected = Buffer.from(this.sign(mediaId, userId, expires), 'hex');
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new AppException(403, 'FORBIDDEN', 'Tautan foto tidak berlaku.');
    const media = await this.authorized(userId, mediaId);
    const image = await this.storage.read(media.storageKey);
    response.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    response.send(image);
  }

  async cleanupOrphans(): Promise<void> {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const old = await this.db.uploadTicket.findMany({ where: { createdAt: { lt: threshold }, status: { not: 'CONSUMED' } }, take: 100 });
    for (const ticket of old) await serial(this.db, async (tx) => {
      const fresh = await tx.uploadTicket.findUnique({ where: { id: ticket.id } });
      if (!fresh || fresh.status === 'CONSUMED' || fresh.createdAt >= threshold) return;
      if (fresh.storageKey) await tx.storageDeletion.upsert({ where: { storageKey: fresh.storageKey }, update: {}, create: { storageKey: fresh.storageKey } });
      await tx.uploadTicket.delete({ where: { id: fresh.id } });
    });
  }
}
