import { Injectable } from '@nestjs/common';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import sharp from 'sharp';
import type { TutorialPhotoFinalizeInput, TutorialPhotoTicketInput } from '@valora/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { StorageService } from '../../infrastructure/storage.service.js';
import { secret } from '../../infrastructure/config.js';
import { MediaService } from '../media/service.js';
import { AppException } from '../../shared/http.js';
import { serial, validId } from '../../shared/transactions.js';
import { authorizeTutorialUpload } from '../../shared/tutorials.js';
import type { RepairGuide } from '@valora/contracts';

export interface EvidenceCopy { ticketId: string; photoId: string; hash: string; storageKey: string }
@Injectable()
export class TutorialPhotosService {
  private readonly signingKey = secret('MEDIA_SIGNING_KEY');
  constructor(private readonly db: DatabaseService, private readonly storage: StorageService, private readonly media: MediaService) {}
  async ticket(actorId: string, sessionId: string, input: TutorialPhotoTicketInput) {
    validId(sessionId);
    const row = await serial(this.db, tx => authorizeTutorialUpload(tx, actorId, sessionId));
    if (!(row.guideSnapshot as unknown as RepairGuide).steps.some(s => s.id === input.stepId)) throw new AppException(400, 'INVALID_INPUT', 'Langkah tidak dikenal.');
    return this.media.ticket(actorId, { fileName: input.fileName, mime: input.mime, bytes: input.bytes, purpose: 'REPAIR_TUTORIAL' }, undefined, undefined, undefined, undefined, sessionId);
  }
  async finalize(actorId: string, sessionId: string, input: TutorialPhotoFinalizeInput) {
    validId(sessionId);
    const ticket = await this.db.uploadTicket.findFirst({ where: { id: input.ticketId, userId: actorId, tutorialSessionId: sessionId, purpose: 'REPAIR_TUTORIAL' } });
    if (!ticket?.storageKey) throw new AppException(400, 'MEDIA_INVALID', 'Foto belum diunggah.');
    const hash = createHash('sha256').update(await this.storage.read(ticket.storageKey)).digest('hex');
    return serial(this.db, async tx => {
      const row = await authorizeTutorialUpload(tx, actorId, sessionId);
      if (!(row.guideSnapshot as unknown as RepairGuide).steps.some(s => s.id === input.stepId)) throw new AppException(400, 'INVALID_INPUT', 'Langkah tidak dikenal.');
      const existing = await tx.repairTutorialPhoto.findUnique({ where: { storageKey: ticket.storageKey! } });
      if (existing && !existing.deletedAt) { if (existing.stepId !== input.stepId) throw new AppException(409, 'STATE_CONFLICT', 'Foto sudah terikat langkah lain.'); return { id: existing.id }; }
      const fresh = await tx.uploadTicket.findUnique({ where: { id: ticket.id } });
      if (fresh?.status !== 'UPLOADED' || fresh.expiresAt <= new Date() || !fresh.actualBytes || !fresh.width || !fresh.height || !fresh.storageKey || fresh.storageKey !== ticket.storageKey) throw new AppException(409, 'STATE_CONFLICT', 'Unggahan tidak tersedia.');
      if (await tx.repairTutorialPhoto.count({ where: { sessionId, deletedAt: null } }) >= 12) throw new AppException(400, 'MEDIA_INVALID', 'Maksimal 12 foto per sesi.');
      const photo = await tx.repairTutorialPhoto.create({ data: { sessionId, createdById: actorId, stepId: input.stepId, storageKey: fresh.storageKey, mime: 'image/webp', bytes: fresh.actualBytes, width: fresh.width, height: fresh.height, hash } });
      await tx.uploadTicket.update({ where: { id: fresh.id }, data: { status: 'CONSUMED', consumedAt: new Date() } });
      return { id: photo.id };
    });
  }
  private async authorized(actorId: string, id: string) {
    validId(id);
    const photo = await this.db.repairTutorialPhoto.findFirst({ where: { id, createdById: actorId, deletedAt: null, session: { createdById: actorId, purgedAt: null } } });
    if (!photo) throw new AppException(404, 'NOT_FOUND', 'Foto panduan tidak ditemukan.');
    return photo;
  }
  private sign(actorId: string, sessionId: string, id: string, expires: number) { return createHmac('sha256', this.signingKey).update([actorId, sessionId, id, expires].join(':')).digest('hex'); }
  async access(actorId: string, id: string) { const p = await this.authorized(actorId, id); const expires = Date.now() + 300000; return { url: `/api/v1/repair-tutorial-photos/${id}/private?expires=${expires}&signature=${this.sign(actorId, p.sessionId, id, expires)}`, expiresAt: new Date(expires).toISOString() }; }
  async privatePhoto(actorId: string, id: string, expiresText: string, signature: string, res: Response) {
    const p = await this.authorized(actorId, id), expires = Number(expiresText);
    if (!Number.isSafeInteger(expires) || expires <= Date.now() || expires > Date.now() + 300000 || !/^[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(this.sign(actorId, p.sessionId, id, expires), 'hex'))) throw new AppException(403, 'FORBIDDEN', 'Tautan foto tidak berlaku.');
    res.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }); res.send(await this.storage.read(p.storageKey));
  }
  async remove(actorId: string, id: string) {
    validId(id);
    return serial(this.db, async tx => {
      const p = await tx.repairTutorialPhoto.findFirst({ where: { id, createdById: actorId, deletedAt: null, session: { createdById: actorId } } });
      if (!p) throw new AppException(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
      await tx.repairTutorialPhoto.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.storageDeletion.upsert({ where: { storageKey: p.storageKey }, update: {}, create: { storageKey: p.storageKey } });
      return { id };
    });
  }
  async inline(actorId: string, sessionId: string, ids: string[]) {
    if (new Set(ids).size !== ids.length) throw new AppException(400, 'MEDIA_INVALID', 'Foto tidak boleh berulang.');
    const photos = await this.db.repairTutorialPhoto.findMany({ where: { id: { in: ids }, sessionId, createdById: actorId, deletedAt: null } });
    if (photos.length !== ids.length) throw new AppException(404, 'NOT_FOUND', 'Foto sesi tidak ditemukan.');
    const content = []; let total = 0;
    for (const id of ids) { const photo = photos.find(p => p.id === id)!; const image = await sharp(await this.storage.read(photo.storageKey), { limitInputPixels: 20000000 }).resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toBuffer(); total += image.length; content.push({ type: 'image_url' as const, image_url: { url: 'data:image/webp;base64,' + image.toString('base64') } }); }
    if (total > 3 * 1024 * 1024) throw new AppException(400, 'MEDIA_INVALID', 'Foto terpilih melebihi batas pemrosesan AI. Pilih lebih sedikit.');
    return { content, photos: photos.map(p => ({ id: p.id, hash: p.hash })) };
  }
  async copyEvidence(actorId: string, sessionId: string, ids: string[]): Promise<EvidenceCopy[]> {
    if (new Set(ids).size !== ids.length || ids.length > 4) throw new AppException(400, 'MEDIA_INVALID', 'Pilih maksimal empat foto berbeda.');
    const result: EvidenceCopy[] = [];
    try {
      for (const id of ids) {
        const p = await this.authorized(actorId, id);
        if (p.sessionId !== sessionId) throw new AppException(404, 'NOT_FOUND', 'Foto tidak berasal dari sesi ini.');
        const ticketId = randomUUID(), storageKey = ticketId + '.webp';
        const bytes = await this.storage.read(p.storageKey);
        await this.storage.write(storageKey, bytes);
        const copy = { ticketId, storageKey, photoId: p.id, hash: p.hash }; result.push(copy);
        await serial(this.db, async tx => {
          const row = await authorizeTutorialUpload(tx, actorId, sessionId);
          await tx.uploadTicket.create({ data: { id: ticketId, userId: actorId, itemId: row.itemId, fileName: 'tutorial-evidence.webp', declaredMime: 'image/webp', declaredBytes: bytes.length, actualMime: 'image/webp', actualBytes: bytes.length, width: p.width, height: p.height, storageKey, purpose: 'REPAIR_EVIDENCE', status: 'UPLOADED', uploadedAt: new Date(), expiresAt: new Date(Date.now() + 900000) } });
        });
      }
      return result;
    } catch (error) { await this.discardUnused(result); throw error; }
  }
  async validateCopies(tx: Prisma.TransactionClient, actorId: string, sessionId: string, ids: string[], copies: EvidenceCopy[]) {
    const originals = await tx.repairTutorialPhoto.findMany({ where: { id: { in: ids }, sessionId, createdById: actorId, deletedAt: null } });
    if (originals.length !== ids.length || copies.some(c => !originals.some(p => p.id === c.photoId && p.hash === c.hash))) throw new AppException(409, 'STATE_CONFLICT', 'Foto terpilih berubah.');
  }
  async discardUnused(copies: EvidenceCopy[]) {
    for (const copy of copies) await serial(this.db, async tx => {
      const t = await tx.uploadTicket.findUnique({ where: { id: copy.ticketId } });
      if (t?.status === 'CONSUMED') return;
      await tx.storageDeletion.upsert({ where: { storageKey: copy.storageKey }, update: {}, create: { storageKey: copy.storageKey } });
      if (t) await tx.uploadTicket.delete({ where: { id: t.id } });
    });
  }
}
