import { invalidateTutorials } from '../../shared/tutorials.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ItemDto, ItemCreateInput, ItemPatchInput } from '@valora/contracts';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { MediaService } from "../media/service.js";
import { StorageService } from '../../infrastructure/storage.service.js';
import { AppException } from '../../shared/http.js';
import { serial, lockRows } from '../../shared/transactions.js';
import { event } from '../history/ledger.js';
import { pauseListingsForItem } from '../listings/state.js';

type ItemWithMedia = Prisma.ItemGetPayload<{ include: { media: true } }>;

function itemDto(item: ItemWithMedia): ItemDto {
  return {
    id: item.id, title: item.title, description: item.description,
    categoryCode: item.categoryCode, subcategoryCode: item.subcategoryCode,
    functionSummary: item.functionSummary, conditionSummary: item.conditionSummary,
    completenessSummary: item.completenessSummary, issueSummary: item.issueSummary,
    purchaseYear: item.purchaseYear, originalPriceIdr: item.originalPriceIdr === null ? null : Number(item.originalPriceIdr),
    estimatedWeightGrams: item.estimatedWeightGrams, itemRevision: item.itemRevision, version: item.version,
    reservedByTransactionId: item.reservedByTransactionId,
    createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
    media: item.media.filter((media) => !media.deletedAt && !media.repairRecordId && !media.caseId && (media.uploadedById === item.currentOwnerId || media.shareWithFutureOwner)).sort((a, b) => a.orderIndex - b.orderIndex).map((media) => ({
      id: media.id, mime: media.mime, bytes: media.bytes, orderIndex: media.orderIndex, processedAt: media.processedAt.toISOString(),
    })),
  };
}

@Injectable()
export class ItemsService {
  constructor(private readonly db: DatabaseService, private readonly media: MediaService, private readonly storage: StorageService) {}

  private async validateCategory(categoryCode: string, subcategoryCode: string | null | undefined): Promise<void> {
    const category = await this.db.category.findUnique({ where: { code: categoryCode } });
    if (!category || !category.active || category.parentCode) throw new AppException(400, 'INVALID_INPUT', 'Kategori tidak tersedia.');
    if (categoryCode === 'hobby') {
      if (!subcategoryCode) return;
      const subcategory = subcategoryCode ? await this.db.category.findUnique({ where: { code: subcategoryCode } }) : null;
      if (!subcategory || !subcategory.active || subcategory.parentCode !== categoryCode) throw new AppException(400, 'INVALID_INPUT', 'Pilih subkategori barang hobi.');
    } else if (subcategoryCode) throw new AppException(400, 'INVALID_INPUT', 'Subkategori tidak sesuai kategori.');
  }

  async create(userId: string, input: ItemCreateInput): Promise<ItemDto> {
    await this.validateCategory(input.categoryCode, input.subcategoryCode);
    const uniqueIds = [...new Set(input.uploadTicketIds)];
    if (uniqueIds.length !== input.uploadTicketIds.length) throw new AppException(400, 'MEDIA_INVALID', 'Foto yang sama tidak dapat dipakai dua kali.');
    const item = await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [userId]);
      const now = new Date();
      const tickets = await tx.uploadTicket.findMany({ where: { id: { in: uniqueIds }, userId, itemId: null, purpose: 'ITEM', status: 'UPLOADED', expiresAt: { gt: now } } });
      if (tickets.length !== uniqueIds.length || tickets.some((ticket) => !ticket.storageKey || !ticket.actualBytes || !ticket.actualMime)) throw new AppException(400, 'MEDIA_INVALID', 'Satu atau beberapa foto belum berhasil diunggah.');
      const claimed = await tx.uploadTicket.updateMany({ where: { id: { in: uniqueIds }, userId, itemId: null, purpose: 'ITEM', status: 'UPLOADED', expiresAt: { gt: now } }, data: { status: 'CONSUMED', consumedAt: now } });
      if (claimed.count !== uniqueIds.length) throw new AppException(409, 'STATE_CONFLICT', 'Foto telah digunakan pada Item lain.');
      const created = await tx.item.create({ data: {
        currentOwnerId: userId, categoryCode: input.categoryCode, subcategoryCode: input.subcategoryCode ?? null,
        title: input.title, description: input.description,
        functionSummary: input.functionSummary ?? null, conditionSummary: input.conditionSummary ?? null,
        completenessSummary: input.completenessSummary ?? null, issueSummary: input.issueSummary ?? null,
        purchaseYear: input.purchaseYear ?? null, originalPriceIdr: input.originalPriceIdr === null || input.originalPriceIdr === undefined ? null : BigInt(input.originalPriceIdr),
        estimatedWeightGrams: input.estimatedWeightGrams ?? null,
      } });
      await event(tx, created.id, 'REGISTERED', 'ITEM', created.id, created.createdAt);
      await tx.mediaAsset.createMany({ data: uniqueIds.map((id, index) => {
        const ticket = tickets.find((entry) => entry.id === id)!;
        return { itemId: created.id, uploadedById: userId, storageKey: ticket.storageKey!, mime: ticket.actualMime!, bytes: ticket.actualBytes!, orderIndex: index, processedAt: ticket.uploadedAt ?? now };
      }) });
      await tx.uploadTicket.updateMany({ where: { id: { in: uniqueIds } }, data: { itemId: created.id } });
      return tx.item.findUniqueOrThrow({ where: { id: created.id }, include: { media: true } });
    });
    return itemDto(item);
  }

  async list(userId: string, limitText?: string, cursor?: string): Promise<{ data: ItemDto[]; meta: { nextCursor: string | null } }> {
    const limit = limitText === undefined ? 20 : Number(limitText);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new AppException(400, 'INVALID_INPUT', 'Limit harus antara 1 dan 50.');
    let before: { createdAt: Date; id: string } | undefined;
    if (cursor) {
      try {
        const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { createdAt: string; id: string };
        if (!/^[0-9a-f-]{36}$/i.test(parsed.id) || Number.isNaN(Date.parse(parsed.createdAt))) throw new Error('invalid');
        before = { createdAt: new Date(parsed.createdAt), id: parsed.id };
      } catch { throw new AppException(400, 'INVALID_INPUT', 'Cursor daftar tidak valid.'); }
    }
    const items = await this.db.item.findMany({
      where: {
        currentOwnerId: userId, archivedAt: null,
        ...(before ? { OR: [{ createdAt: { lt: before.createdAt } }, { createdAt: before.createdAt, id: { lt: before.id } }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1, include: { media: true },
    });
    const hasMore = items.length > limit;
    const page = items.slice(0, limit);
    const last = page.at(-1);
    return { data: page.map(itemDto), meta: { nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id })).toString('base64url') : null } };
  }

  async get(userId: string, id: string): Promise<ItemDto> {
    const item = await this.db.item.findFirst({ where: { id, currentOwnerId: userId, archivedAt: null }, include: { media: true } });
    if (!item) throw new AppException(404, 'NOT_FOUND', 'Item tidak ditemukan.');
    return itemDto(item);
  }

  async patch(userId: string, id: string, input: ItemPatchInput): Promise<ItemDto> {
    const current = await this.db.item.findFirst({ where: { id, currentOwnerId: userId, archivedAt: null } });
    if (!current) throw new AppException(404, 'NOT_FOUND', 'Item tidak ditemukan.');
    if (current.reservedByTransactionId) throw new AppException(409, 'ITEM_RESERVED', 'Item sedang dalam kesepakatan dan tidak dapat diubah.');
    const categoryCode = input.categoryCode ?? current.categoryCode;
    const subcategoryCode = input.subcategoryCode === undefined ? current.subcategoryCode : input.subcategoryCode;
    await this.validateCategory(categoryCode, subcategoryCode);
    const materialKeys = ['description', 'categoryCode', 'subcategoryCode', 'functionSummary', 'conditionSummary', 'completenessSummary', 'issueSummary'] as const;
    const materialChanged = materialKeys.some((key) => input[key] !== undefined && input[key] !== current[key]);
    const data: Prisma.ItemUpdateManyMutationInput = { version: { increment: 1 }, ...(materialChanged ? { itemRevision: { increment: 1 } } : {}) };
    const fields = ['title', 'description', 'categoryCode', 'subcategoryCode', 'functionSummary', 'conditionSummary', 'completenessSummary', 'issueSummary', 'purchaseYear', 'estimatedWeightGrams'] as const;
    for (const key of fields) {
      if (input[key] !== undefined) Object.assign(data, { [key]: input[key] });
    }
    if (input.originalPriceIdr !== undefined) data.originalPriceIdr = input.originalPriceIdr === null ? null : BigInt(input.originalPriceIdr);
    await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [userId]);
      await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${id}::uuid FOR UPDATE`;
      const changed = await tx.item.updateMany({ where: { id, currentOwnerId: userId, version: input.expectedVersion, archivedAt: null, reservedByTransactionId: null }, data });
      if (changed.count !== 1) throw new AppException(409, 'STATE_CONFLICT', 'Item sudah berubah. Muat ulang sebelum menyimpan.');
      if (materialChanged) { await invalidateTutorials(tx, id); await pauseListingsForItem(tx, id); }
    });
    return this.get(userId, id);
  }

  async finalizeMedia(userId: string, itemId: string, ticketId: string): Promise<ItemDto> {
    const item = await this.db.item.findFirst({ where: { id: itemId, currentOwnerId: userId, archivedAt: null }, include: { media: { where: { deletedAt: null, repairRecordId: null, caseId: null, OR: [{ uploadedById: userId }, { shareWithFutureOwner: true }] } } } });
    if (!item) throw new AppException(404, 'NOT_FOUND', 'Item tidak ditemukan.');
    if (item.reservedByTransactionId) throw new AppException(409, 'ITEM_RESERVED', 'Item sedang dalam kesepakatan.');
    if (item.media.length >= 8) throw new AppException(400, 'MEDIA_INVALID', 'Maksimal delapan foto per Item.');
    await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [userId]);
      const now = new Date();
      const ticket = await tx.uploadTicket.findFirst({ where: { id: ticketId, userId, itemId, purpose: 'ITEM', status: 'UPLOADED', expiresAt: { gt: now } } });
      if (!ticket?.storageKey || !ticket.actualMime || !ticket.actualBytes) throw new AppException(400, 'MEDIA_INVALID', 'Foto belum berhasil diunggah.');
      const claimed = await tx.uploadTicket.updateMany({ where: { id: ticketId, status: 'UPLOADED', userId, itemId, purpose: 'ITEM', expiresAt: { gt: now } }, data: { status: 'CONSUMED', consumedAt: now } });
      if (claimed.count !== 1) throw new AppException(409, 'STATE_CONFLICT', 'Foto sudah digunakan.');
      const changed = await tx.item.updateMany({ where: { id: itemId, currentOwnerId: userId, version: item.version, archivedAt: null, reservedByTransactionId: null }, data: { version: { increment: 1 }, itemRevision: { increment: 1 } } });
      if (changed.count !== 1) throw new AppException(409, 'STATE_CONFLICT', 'Item sudah berubah. Muat ulang sebelum mengunggah.');
      await tx.mediaAsset.create({ data: { itemId, uploadedById: userId, storageKey: ticket.storageKey, mime: ticket.actualMime, bytes: ticket.actualBytes, orderIndex: Math.max(-1, ...item.media.map((media) => media.orderIndex)) + 1, processedAt: ticket.uploadedAt ?? now } });
      await invalidateTutorials(tx, itemId); await pauseListingsForItem(tx, itemId);
    });
    return this.get(userId, itemId);
  }

  async deleteMedia(userId: string, itemId: string, mediaId: string): Promise<ItemDto> {
    const item = await this.db.item.findFirst({ where: { id: itemId, currentOwnerId: userId, archivedAt: null }, include: { media: { where: { deletedAt: null, repairRecordId: null, caseId: null, OR: [{ uploadedById: userId }, { shareWithFutureOwner: true }] } } } });
    if (!item) throw new AppException(404, 'NOT_FOUND', 'Item tidak ditemukan.');
    if (item.reservedByTransactionId) throw new AppException(409, 'ITEM_RESERVED', 'Item sedang dalam kesepakatan.');
    if (item.media.length <= 1) throw new AppException(409, 'STATE_CONFLICT', 'Item harus memiliki setidaknya satu foto.');
    const asset = item.media.find((media) => media.id === mediaId && !media.caseId && (media.uploadedById === userId || media.shareWithFutureOwner));
    if (!asset) throw new AppException(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
    await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [userId]);
      const changed = await tx.item.updateMany({ where: { id: itemId, currentOwnerId: userId, version: item.version, archivedAt: null, reservedByTransactionId: null }, data: { version: { increment: 1 }, itemRevision: { increment: 1 } } });
      if (changed.count !== 1) throw new AppException(409, 'STATE_CONFLICT', 'Item sudah berubah. Muat ulang sebelum menghapus foto.');
      await tx.mediaAsset.update({ where: { id: mediaId }, data: { deletedAt: new Date(), version: { increment: 1 } } });
      await invalidateTutorials(tx, itemId);
      await pauseListingsForItem(tx, itemId);
    });
    await this.storage.remove(asset.storageKey);
    return this.get(userId, itemId);
  }
}
