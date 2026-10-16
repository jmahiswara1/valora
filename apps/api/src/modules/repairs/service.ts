import { assertNoStartedTutorial, invalidateTutorials } from '../../shared/tutorials.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { type RepairDto, type RepairCreateInput, uuidSchema, type RepairCorrectionInput, type RepairVoidInput } from '@valora/contracts';
import { AppException } from '../../shared/http.js';
import { serial, lockRows } from '../../shared/transactions.js';
import { pauseListingsForItem } from '../listings/state.js';
import { repairEvents, event, repairAdjustment } from '../history/ledger.js';

type RepairRow = Prisma.RepairRecordGetPayload<{ include: { evidence: true } }>;

const cursorEncode = (at: Date, id: string) => Buffer.from(JSON.stringify({ at: at.toISOString(), id })).toString('base64url');

const requestHash = (kind: string, id: string, input: unknown) => createHash('sha256').update(`${kind}:${id}:${JSON.stringify(input)}`).digest('hex');

const snapshot = (row: RepairRow) => ({
  performedAt: row.performedAt.toISOString(), actionSummary: row.actionSummary, privateNotes: row.privateNotes,
  costIdr: row.costIdr === null ? null : Number(row.costIdr), costKind: row.costKind,
  outcome: row.outcome, afterCondition: row.afterCondition, status: row.status,
  shareSummaryPublic: row.shareSummaryPublic, shareDetailsWithFutureOwner: row.shareDetailsWithFutureOwner,
  voidReason: row.voidReason,
});

@Injectable()
export class RepairsService {
  constructor(private readonly db: DatabaseService) {}

  private dto(row: RepairRow, viewerId: string, currentOwnerId: string): RepairDto {
    const creator = row.createdById === viewerId;
    const shared = row.status === 'VALID' && row.shareDetailsWithFutureOwner && currentOwnerId === viewerId;
    return {
      activityKind: row.activityKind, ...(creator ? { tutorialSessionId: row.tutorialSessionId } : {}), id: row.id, itemId: row.itemId, ...(creator ? { createdById: row.createdById } : {}), performedAt: row.performedAt.toISOString(),
      actionSummary: row.actionSummary, ...(creator || shared ? { privateNotes: row.privateNotes } : {}),
      ...(creator ? { costIdr: row.costIdr === null ? null : Number(row.costIdr), costKind: row.costKind } : {}),
      outcome: row.outcome, afterCondition: row.afterCondition, status: row.status,
      shareSummaryPublic: row.shareSummaryPublic, ...(creator ? { shareDetailsWithFutureOwner: row.shareDetailsWithFutureOwner, voidReason: row.voidReason } : {}),
      evidence: creator || shared ? row.evidence.filter((media) => !media.deletedAt && (creator || media.shareWithFutureOwner)).map((media) => ({ id: media.id, mime: media.mime, bytes: media.bytes, orderIndex: media.orderIndex, processedAt: media.processedAt.toISOString() })) : [],
      version: row.version, createdAt: row.createdAt.toISOString(), origin: 'USER_REPORTED',
    };
  }

  async create(userId: string, itemId: string, input: RepairCreateInput): Promise<RepairDto> {
    if (!uuidSchema.safeParse(itemId).success) throw new AppException(404, 'NOT_FOUND', 'Barang tidak ditemukan.');
    return serial(this.db, tx => this.createInTransaction(tx, userId, itemId, input));
  }

  async createInTransaction(tx: Prisma.TransactionClient, userId: string, itemId: string, input: RepairCreateInput, tutorialSessionId?: string): Promise<RepairDto> {
    if (new Date(input.performedAt) > new Date()) throw new AppException(400, 'INVALID_INPUT', 'Tanggal tidak boleh di masa depan.');
    if (new Set(input.evidenceTicketIds).size !== input.evidenceTicketIds.length) throw new AppException(400, 'MEDIA_INVALID', 'Foto tidak boleh berulang.');
      await lockRows(tx, 'User', [userId]);
      await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${itemId}::uuid FOR UPDATE`;
      const item = await tx.item.findFirst({ where: { id: itemId, currentOwnerId: userId, archivedAt: null } });
      if (!item) throw new AppException(404, 'NOT_FOUND', 'Item tidak ditemukan.');
      if (item.reservedByTransactionId) throw new AppException(409, 'ITEM_RESERVED', 'Item sedang dalam kesepakatan.');
      if (item.version !== input.expectedItemVersion) throw new AppException(409, 'STATE_CONFLICT', 'Item berubah. Muat ulang sebelum menyimpan Repair.');
      await assertNoStartedTutorial(tx, itemId, tutorialSessionId);
      await invalidateTutorials(tx, itemId, 'MANUAL_RECORD', tutorialSessionId);
      const now = new Date();
      const tickets = await tx.uploadTicket.findMany({ where: { id: { in: input.evidenceTicketIds }, userId, itemId, purpose: 'REPAIR_EVIDENCE', status: 'UPLOADED', expiresAt: { gt: now } } });
      if (tickets.length !== input.evidenceTicketIds.length || tickets.some((ticket) => !ticket.storageKey || !ticket.actualMime || !ticket.actualBytes)) throw new AppException(400, 'MEDIA_INVALID', 'Foto bukti belum berhasil diunggah.');
      const changed = await tx.item.updateMany({ where: { id: itemId, currentOwnerId: userId, version: input.expectedItemVersion, archivedAt: null, reservedByTransactionId: null }, data: { version: { increment: 1 }, ...(item.conditionSummary !== input.afterCondition ? { conditionSummary: input.afterCondition, itemRevision: { increment: 1 } } : {}) } });
      if (changed.count !== 1) throw new AppException(409, 'STATE_CONFLICT', 'Item berubah. Muat ulang sebelum menyimpan Repair.');
      if (item.conditionSummary !== input.afterCondition) await pauseListingsForItem(tx, itemId);
      const claimed = await tx.uploadTicket.updateMany({ where: { id: { in: input.evidenceTicketIds }, userId, itemId, purpose: 'REPAIR_EVIDENCE', status: 'UPLOADED', expiresAt: { gt: now } }, data: { status: 'CONSUMED', consumedAt: now } });
      if (claimed.count !== input.evidenceTicketIds.length) throw new AppException(409, 'STATE_CONFLICT', 'Foto bukti telah dipakai.');
      const record = await tx.repairRecord.create({ data: {
        activityKind: input.activityKind, tutorialSessionId, itemId, createdById: userId, performedAt: new Date(input.performedAt), actionSummary: input.actionSummary,
        privateNotes: input.privateNotes ?? null, costIdr: input.costIdr == null ? null : BigInt(input.costIdr),
        costKind: input.costKind ?? null, outcome: input.outcome, afterCondition: input.afterCondition,
        shareSummaryPublic: input.shareSummaryPublic, shareDetailsWithFutureOwner: input.shareDetailsWithFutureOwner,
      } });
      await repairEvents(tx, record);
      if (tickets.length) await tx.mediaAsset.createMany({ data: input.evidenceTicketIds.map((id, index) => {
        const ticket = tickets.find((entry) => entry.id === id)!;
        return { itemId, repairRecordId: record.id, uploadedById: userId, storageKey: ticket.storageKey!, mime: ticket.actualMime!, bytes: ticket.actualBytes!, orderIndex: index, processedAt: ticket.uploadedAt ?? now, visibility: 'PRIVATE' as const, shareWithFutureOwner: input.shareDetailsWithFutureOwner };
      }) });
      if (tickets.length) await tx.uploadTicket.updateMany({ where: { id: { in: input.evidenceTicketIds } }, data: { itemId } });
      const full = await tx.repairRecord.findUniqueOrThrow({ where: { id: record.id }, include: { evidence: true } });
      return this.dto(full, userId, userId);
  }

  async list(userId: string, itemId: string, limitText?: string, cursorText?: string): Promise<{ data: RepairDto[]; meta: { nextCursor: string | null } }> {
    if (!uuidSchema.safeParse(itemId).success) throw new AppException(404, 'NOT_FOUND', 'Item tidak ditemukan.');
    const item = await this.db.item.findFirst({ where: { id: itemId, currentOwnerId: userId, archivedAt: null } });
    if (!item) throw new AppException(404, 'NOT_FOUND', 'Item tidak ditemukan.');
    const limit = limitText === undefined ? 20 : Number(limitText);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new AppException(400, 'INVALID_INPUT', 'Limit harus antara 1 dan 50.');
    let cursor: { at: Date; id: string } | null = null;
    if (cursorText) {
      try {
        const parsed = JSON.parse(Buffer.from(cursorText, 'base64url').toString('utf8')) as { at: string; id: string };
        if (!uuidSchema.safeParse(parsed.id).success || Number.isNaN(Date.parse(parsed.at))) throw new Error('invalid');
        cursor = { at: new Date(parsed.at), id: parsed.id };
      } catch { throw new AppException(400, 'INVALID_INPUT', 'Cursor daftar tidak valid.'); }
    }
    const rows = await this.db.repairRecord.findMany({ where: { itemId, ...(cursor ? { OR: [{ performedAt: { lt: cursor.at } }, { performedAt: cursor.at, id: { lt: cursor.id } }] } : {}) }, orderBy: [{ performedAt: 'desc' }, { id: 'desc' }], take: limit + 1, include: { evidence: true } });
    const page = rows.slice(0, limit);
    return { data: page.map((row) => this.dto(row, userId, item.currentOwnerId)), meta: { nextCursor: rows.length > limit && page.at(-1) ? cursorEncode(page.at(-1)!.performedAt, page.at(-1)!.id) : null } };
  }

  async correct(userId: string, id: string, input: RepairCorrectionInput, idempotencyKey?: string): Promise<RepairDto> {
    if (!uuidSchema.safeParse(id).success) throw new AppException(404, 'NOT_FOUND', 'Repair tidak ditemukan.');
    if (!uuidSchema.safeParse(idempotencyKey).success) throw new AppException(400, 'INVALID_INPUT', 'Idempotency-Key UUID wajib diisi.');
    const payloadHash = requestHash('CORRECTION', id, input);
    if (input.performedAt && new Date(input.performedAt) > new Date()) throw new AppException(400, 'INVALID_INPUT', 'Tanggal Repair tidak boleh di masa depan.');
    const fields = ['performedAt', 'actionSummary', 'privateNotes', 'costIdr', 'costKind', 'outcome', 'afterCondition', 'shareSummaryPublic', 'shareDetailsWithFutureOwner'] as const;
    if (!fields.some((field) => input[field] !== undefined)) throw new AppException(400, 'INVALID_INPUT', 'Isi perubahan yang ingin dikoreksi.');
    return serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [userId]);
      await tx.$queryRaw`SELECT id FROM "RepairRecord" WHERE id = ${id}::uuid FOR UPDATE`;
      const row = await tx.repairRecord.findUnique({ where: { id }, include: { evidence: true, item: true } });
      if (!row || row.createdById !== userId) throw new AppException(404, 'NOT_FOUND', 'Repair tidak ditemukan.');
      const prior = await tx.repairCorrection.findUnique({ where: { createdById_idempotencyKey: { createdById: userId, idempotencyKey: idempotencyKey! } } });
      if (prior) {
        if (prior.repairId !== id || prior.kind !== 'CORRECTION' || prior.payloadHash !== payloadHash || !prior.responseSnapshot) throw new AppException(409, 'IDEMPOTENCY_CONFLICT', 'Kunci permintaan telah dipakai untuk perubahan lain.');
        return prior.responseSnapshot as unknown as RepairDto;
      }
      if (row.item.reservedByTransactionId) throw new AppException(409, 'ITEM_RESERVED', 'Item sedang dalam kesepakatan.');
      if (row.status !== 'VALID' || row.version !== input.expectedVersion) throw new AppException(409, 'STATE_CONFLICT', 'Repair telah berubah atau dibatalkan.');
      const newCost = input.costIdr === undefined ? row.costIdr : input.costIdr === null ? null : BigInt(input.costIdr);
      const newKind = input.costKind === undefined ? row.costKind : input.costKind;
      if ((newCost === null) !== (newKind === null)) throw new AppException(400, 'INVALID_INPUT', 'Nominal dan jenis biaya harus diisi bersama.');
      const before = snapshot(row);
      const updated = await tx.repairRecord.update({ where: { id }, data: {
        ...(input.performedAt !== undefined ? { performedAt: new Date(input.performedAt) } : {}),
        ...(input.actionSummary !== undefined ? { actionSummary: input.actionSummary } : {}),
        ...(input.privateNotes !== undefined ? { privateNotes: input.privateNotes } : {}),
        ...(input.costIdr !== undefined ? { costIdr: newCost } : {}),
        ...(input.costKind !== undefined ? { costKind: newKind } : {}),
        ...(input.outcome !== undefined ? { outcome: input.outcome } : {}),
        ...(input.afterCondition !== undefined ? { afterCondition: input.afterCondition } : {}),
        ...(input.shareSummaryPublic !== undefined ? { shareSummaryPublic: input.shareSummaryPublic } : {}),
        ...(input.shareDetailsWithFutureOwner !== undefined ? { shareDetailsWithFutureOwner: input.shareDetailsWithFutureOwner } : {}),
        version: { increment: 1 },
      }, include: { evidence: true } });
      if (input.shareDetailsWithFutureOwner !== undefined) await tx.mediaAsset.updateMany({ where: { repairRecordId: id }, data: { shareWithFutureOwner: input.shareDetailsWithFutureOwner } });
      if (input.afterCondition && input.afterCondition !== row.afterCondition && row.item.currentOwnerId === userId && row.item.conditionSummary === row.afterCondition && !row.item.reservedByTransactionId) {
        await tx.item.update({ where: { id: row.itemId }, data: { conditionSummary: input.afterCondition, version: { increment: 1 }, itemRevision: { increment: 1 } } });
        await invalidateTutorials(tx, row.itemId, 'RECORD_CHANGED');
        await pauseListingsForItem(tx, row.itemId);
      }
      const originalEvent = await tx.passportEvent.findUnique({ where: { eventKey: [row.activityKind === 'MAINTENANCE' ? 'MAINTENANCE_RECORDED' : 'REPAIR_RECORDED', row.id, row.itemId, ''].join(':') } });
      await event(tx, row.itemId, 'CORRECTION', 'REPAIR', row.id, new Date(), { kind: 'REPAIR_UPDATED' }, 'v' + updated.version, 'USER_REPORTED', originalEvent?.id);
      const response = this.dto(updated, userId, row.item.currentOwnerId);
      await tx.repairCorrection.create({ data: { repairId: id, createdById: userId, version: updated.version, kind: 'CORRECTION', reason: input.reason, idempotencyKey, payloadHash, responseSnapshot: response as unknown as Prisma.InputJsonValue, beforeState: before as Prisma.InputJsonValue, afterState: snapshot(updated) as Prisma.InputJsonValue } });
      return response;
    });
  }

  async void(userId: string, id: string, input: RepairVoidInput, idempotencyKey?: string): Promise<RepairDto> {
    if (!uuidSchema.safeParse(id).success) throw new AppException(404, 'NOT_FOUND', 'Repair tidak ditemukan.');
    if (!uuidSchema.safeParse(idempotencyKey).success) throw new AppException(400, 'INVALID_INPUT', 'Idempotency-Key UUID wajib diisi.');
    const payloadHash = requestHash('VOID', id, input);
    return serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [userId]);
      await tx.$queryRaw`SELECT id FROM "RepairRecord" WHERE id = ${id}::uuid FOR UPDATE`;
      const row = await tx.repairRecord.findUnique({ where: { id }, include: { evidence: true, item: true } });
      if (!row || row.createdById !== userId) throw new AppException(404, 'NOT_FOUND', 'Repair tidak ditemukan.');
      const prior = await tx.repairCorrection.findUnique({ where: { createdById_idempotencyKey: { createdById: userId, idempotencyKey: idempotencyKey! } } });
      if (prior) {
        if (prior.repairId !== id || prior.kind !== 'VOID' || prior.payloadHash !== payloadHash || !prior.responseSnapshot) throw new AppException(409, 'IDEMPOTENCY_CONFLICT', 'Kunci permintaan telah dipakai untuk perubahan lain.');
        return prior.responseSnapshot as unknown as RepairDto;
      }
      if (row.item.reservedByTransactionId) throw new AppException(409, 'ITEM_RESERVED', 'Item sedang dalam kesepakatan.');
      if (row.status !== 'VALID' || row.version !== input.expectedVersion) throw new AppException(409, 'STATE_CONFLICT', 'Repair telah berubah atau dibatalkan.');
      const before = snapshot(row);
      const updated = await tx.repairRecord.update({ where: { id }, data: { status: 'VOID', voidReason: input.reason, version: { increment: 1 } }, include: { evidence: true } });
      if (row.item.currentOwnerId === userId && !row.item.reservedByTransactionId) {
        await tx.item.update({ where: { id: row.itemId }, data: { version: { increment: 1 }, itemRevision: { increment: 1 } } });
        await invalidateTutorials(tx, row.itemId, 'RECORD_CHANGED');
        await pauseListingsForItem(tx, row.itemId);
      }
      await repairAdjustment(tx, row, updated.version, -1n, input.reason);
      const response = this.dto(updated, userId, row.item.currentOwnerId);
      await tx.repairCorrection.create({ data: { repairId: id, createdById: userId, version: updated.version, kind: 'VOID', reason: input.reason, idempotencyKey, payloadHash, responseSnapshot: response as unknown as Prisma.InputJsonValue, beforeState: before as Prisma.InputJsonValue, afterState: snapshot(updated) as Prisma.InputJsonValue } });
      return response;
    });
  }
}
