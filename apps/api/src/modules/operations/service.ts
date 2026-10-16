import { invalidateTutorials } from '../../shared/tutorials.js';
import { attachmentDto } from '../conversations/message.js';
import { expireOffers } from '../notifications/events.js';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { MediaService } from "../media/service.js";
import { StorageService } from '../../infrastructure/storage.service.js';
import { z } from 'zod';
import { correctionOpenSchema, versionReasonSchema, type TransactionSnapshot, correctionEvidenceSchema, type MediaTicketInput, ownershipCorrectionSchema, impactCorrectionSchema, sourceCorrectionSchema, passportRestrictionSchema } from '@valora/contracts';
import { idempotent, lockTransaction, participant, validId, lockRows, serial, json, activeTransactionStatuses, closeForAccount } from '../../shared/transactions.js';
import { AppException } from '../../shared/http.js';
import { page, cursorId } from '../../shared/pagination.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { requestContext } from '../../shared/request-context.js';
import type { Response } from 'express';
import { event, repairAdjustment, contribution } from '../history/ledger.js';
import { audit, type OperationsScope, assignedScope, scopeItem } from './helpers.js';

function caseMeta(row: { id: string; transactionId: string; status: string; assignedAdminId: string | null; version: number; resolution: string | null; createdAt: Date; resolvedAt: Date | null }) {
  return { id: row.id, transactionId: row.transactionId, status: row.status, assignedAdminId: row.assignedAdminId, version: row.version, resolution: row.resolution, createdAt: row.createdAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null };
}

@Injectable()
export class OperationsService {
  constructor(private readonly db: DatabaseService, private readonly media: MediaService, private readonly storage: StorageService) {}
  async open(actorId: string, transactionId: string, input: z.infer<typeof correctionOpenSchema>, key?: string) {
    return idempotent(this.db, actorId, 'correction-open:' + transactionId, key, input, async (tx) => {
      const row = await lockTransaction(tx, transactionId);
      const admin = await tx.user.findFirst({ where: { id: actorId, role: 'ADMIN', status: 'ACTIVE' } });
      if (!admin) participant(row, actorId);
      if (row.status !== 'COMPLETED' || row.version !== input.expectedVersion || await tx.correctionCase.findFirst({ where: { transactionId, status: { in: ['OPEN', 'IN_REVIEW'] } } })) throw new AppException(409, 'STATE_CONFLICT', 'Transaksi harus selesai dan belum mempunyai kasus koreksi aktif.');
      const created = await tx.correctionCase.create({ data: { transactionId, openedById: actorId, reason: input.reason, ...(admin ? { assignedAdminId: actorId, status: 'IN_REVIEW' } : {}) } });
      await tx.correctionEvidence.create({ data: { caseId: created.id, submittedById: actorId, note: input.reason } });
      if (admin) await audit(tx, actorId, 'CORRECTION', created.id, 'OPEN_CORRECTION', input.reason);
      return caseMeta(created);
    });
  }
  async caseList(cursor?: string) { return page((await this.db.correctionCase.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...cursorId(cursor), take: 31 })).map(caseMeta)); }
  async caseMetadata(id: string) { validId(id); const row = await this.db.correctionCase.findUnique({ where: { id } }); if (!row) throw new AppException(404, 'NOT_FOUND', 'Kasus tidak ditemukan.'); return caseMeta(row); }
  async claim(adminId: string, id: string, input: z.infer<typeof versionReasonSchema>, key?: string) {
    return idempotent(this.db, adminId, 'correction-claim:' + id, key, input, async (tx) => {
      await lockRows(tx, 'CorrectionCase', [id]);
      const row = await tx.correctionCase.findUnique({ where: { id } });
      if (!row || row.version !== input.expectedVersion || !['OPEN', 'IN_REVIEW'].includes(row.status) || (row.assignedAdminId && row.assignedAdminId !== adminId)) throw new AppException(409, 'STATE_CONFLICT', 'Penugasan kasus sudah berubah.');
      const updated = await tx.correctionCase.update({ where: { id }, data: { assignedAdminId: adminId, status: 'IN_REVIEW', version: { increment: 1 } } });
      await audit(tx, adminId, 'CORRECTION', id, 'CLAIM_CORRECTION', input.reason);
      return caseMeta(updated);
    });
  }
  async grant(adminId: string, type: OperationsScope, id: string, reason: string, key?: string) {
    return idempotent(this.db, adminId, 'operations-grant:' + type + ':' + id, key, { reason }, async (tx) => {
      await assignedScope(tx, adminId, type, id, true);
      const expiresAt = new Date(Date.now() + 300000);
      const grant = await tx.operationsAccessGrant.create({ data: { scopeType: type, scopeId: id, adminId, reason, expiresAt } });
      await audit(tx, adminId, type, id, 'ACCESS_PRIVATE', reason, undefined, { grantId: grant.id, expiresAt: expiresAt.toISOString() });
      return { id: grant.id, expiresAt: expiresAt.toISOString() };
    });
  }
  async requireGrant(tx: Prisma.TransactionClient, adminId: string, type: OperationsScope, id: string) {
    await assignedScope(tx, adminId, type, id, true);
    const granted = type === 'DISPUTE' ? await tx.caseAccessGrant.findFirst({ where: { caseId: id, adminId, kind: 'EVIDENCE', expiresAt: { gt: new Date() } } }) : await tx.operationsAccessGrant.findFirst({ where: { scopeType: type, scopeId: id, adminId, expiresAt: { gt: new Date() } } });
    if (!granted) throw new AppException(403, 'ACCESS_REASON_REQUIRED', 'Buka akses kasus dengan alasan terlebih dahulu.');
    const store = requestContext.getStore(); if (store) store.accessExpiresAt = granted.expiresAt.toISOString();
  }
  async caseGet(actorId: string, id: string) {
    validId(id);
    return serial(this.db, async (tx) => {
      const row = await tx.correctionCase.findUnique({ where: { id } });
      if (!row) throw new AppException(404, 'NOT_FOUND', 'Kasus tidak ditemukan.');
      const transaction = await tx.transaction.findUniqueOrThrow({ where: { id: row.transactionId } });
      const isParticipant = [transaction.sellerOrDonorId, transaction.buyerOrRecipientId].includes(actorId);
      if (!isParticipant) await this.requireGrant(tx, actorId, 'CORRECTION', id);
      const evidence = await tx.correctionEvidence.findMany({ where: { caseId: id }, orderBy: { createdAt: 'asc' }, include: { attachments: { where: { deletedAt: null }, orderBy: { orderIndex: 'asc' } } } });
      const snapshot = transaction.snapshot as unknown as TransactionSnapshot;
      const itemIds = snapshot.items.map((i) => i.id);
      const sources = { assessments: await tx.assessment.findMany({ where: { itemId: { in: itemIds } }, select: { id: true, itemId: true, version: true, valid: true, status: true } }), repairs: await tx.repairRecord.findMany({ where: { itemId: { in: itemIds } }, select: { id: true, itemId: true, version: true, status: true } }) };
      const passports = await tx.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, passportVersion: true, passportVisibility: true } });
      return { ...caseMeta(row), sources, passports, reason: row.reason, resolutionReason: row.resolutionReason, transaction: { id: transaction.id, version: transaction.version, type: transaction.type, correctedAt: transaction.correctedAt?.toISOString() ?? null, finalPriceIdr: transaction.finalPriceIdr?.toString() ?? null, items: snapshot.items.map((i) => ({ id: i.id, title: i.title, estimatedWeightGrams: i.estimatedWeightGrams, assessmentId: i.assessmentId })) }, evidence: evidence.map((e) => ({ id: e.id, note: e.note, messageSnapshot: e.messageSnapshot, createdAt: e.createdAt.toISOString(), purgedAt: e.purgedAt?.toISOString() ?? null, media: e.attachments.map((m) => ({ id: m.id, url: '/api/v1/correction-cases/' + id + '/media/' + m.id })) })) };
    });
  }
  async evidence(actorId: string, id: string, input: z.infer<typeof correctionEvidenceSchema>, key?: string) {
    return idempotent(this.db, actorId, 'correction-evidence:' + id, key, input, async (tx) => {
      const row = await tx.correctionCase.findUnique({ where: { id } });
      if (!row) throw new AppException(404, 'NOT_FOUND', 'Kasus tidak ditemukan.');
      const transaction = await lockTransaction(tx, row.transactionId);
      await lockRows(tx, 'CorrectionCase', [id]);
      const fresh = await tx.correctionCase.findUniqueOrThrow({ where: { id } });
      const isParticipant = [transaction.sellerOrDonorId, transaction.buyerOrRecipientId].includes(actorId);
      if (!isParticipant) await this.requireGrant(tx, actorId, 'CORRECTION', id);
      if (fresh.version !== input.expectedVersion || !['OPEN', 'IN_REVIEW'].includes(fresh.status)) throw new AppException(409, 'STATE_CONFLICT', 'Kasus sudah berubah.');
      let snapshot: unknown;
      if (input.messageId) {
        const message = await tx.message.findFirst({ where: { id: input.messageId, deletedAt: null }, include: { conversation: true, attachments: { where: { deletedAt: null }, orderBy: { orderIndex: 'asc' } } } });
        if (!message || message.conversation.listingId !== transaction.listingId || ![message.conversation.participantAId, message.conversation.participantBId].every((p) => [transaction.sellerOrDonorId, transaction.buyerOrRecipientId].includes(p))) throw new AppException(404, 'NOT_FOUND', 'Pesan tidak terkait transaksi.');
        snapshot = { id: message.id, senderId: message.senderId, body: message.body, sentAt: message.sentAt.toISOString(), attachments: message.attachments.map(attachmentDto) };
      }
      if (new Set(input.ticketIds).size !== input.ticketIds.length) throw new AppException(400, 'MEDIA_INVALID', 'Foto bukti tidak boleh berulang.');
      const tickets = await tx.uploadTicket.findMany({ where: { id: { in: input.ticketIds }, correctionCaseId: id, userId: actorId, purpose: 'CASE_EVIDENCE', status: 'UPLOADED', expiresAt: { gt: new Date() } } });
      if (tickets.length !== input.ticketIds.length || tickets.some((t) => !t.storageKey || !t.actualMime || !t.actualBytes)) throw new AppException(400, 'MEDIA_INVALID', 'Foto bukti belum tersedia.');
      const created = await tx.correctionEvidence.create({ data: { caseId: id, submittedById: actorId, note: input.note, messageId: input.messageId, ...(snapshot ? { messageSnapshot: json(snapshot) } : {}) } });
      const claimed = await tx.uploadTicket.updateMany({ where: { id: { in: input.ticketIds }, status: 'UPLOADED', correctionCaseId: id, userId: actorId, expiresAt: { gt: new Date() } }, data: { status: 'CONSUMED', consumedAt: new Date() } });
      if (claimed.count !== tickets.length) throw new AppException(409, 'STATE_CONFLICT', 'Foto bukti sudah dipakai.');
      for (const [orderIndex, ticket] of tickets.entries()) await tx.correctionAttachment.create({ data: { evidenceId: created.id, storageKey: ticket.storageKey!, mime: ticket.actualMime!, bytes: ticket.actualBytes!, orderIndex } });
      const updated = await tx.correctionCase.update({ where: { id }, data: { version: { increment: 1 } } });
      return caseMeta(updated);
    });
  }
  async ticket(actorId: string, id: string, input: MediaTicketInput) {
    await this.caseGet(actorId, id);
    const row = await this.db.correctionCase.findUniqueOrThrow({ where: { id } });
    if (!['OPEN', 'IN_REVIEW'].includes(row.status)) throw new AppException(409, 'STATE_CONFLICT', 'Kasus sudah ditutup.');
    return this.media.ticket(actorId, input, undefined, undefined, id);
  }
  async photo(actorId: string, id: string, mediaId: string, response: Response) {
    validId(mediaId); await this.caseGet(actorId, id);
    const asset = await this.db.correctionAttachment.findFirst({ where: { id: mediaId, deletedAt: null, evidence: { caseId: id } } });
    if (!asset) throw new AppException(404, 'NOT_FOUND', 'Foto bukti tidak ditemukan.');
    response.setHeader('Cache-Control', 'private, no-store'); response.type(asset.mime).send(await this.storage.read(asset.storageKey));
  }
  async close(adminId: string, id: string, input: z.infer<typeof versionReasonSchema>, key?: string) {
    return idempotent(this.db, adminId, 'correction-close:' + id, key, input, async (tx) => {
      await lockRows(tx, 'CorrectionCase', [id]); await assignedScope(tx, adminId, 'CORRECTION', id); await this.requireGrant(tx, adminId, 'CORRECTION', id);
      const row = await tx.correctionCase.findUniqueOrThrow({ where: { id } });
      if (row.version !== input.expectedVersion) throw new AppException(409, 'STATE_CONFLICT', 'Kasus sudah berubah.');
      const updated = await tx.correctionCase.update({ where: { id }, data: { status: 'RESOLVED', resolution: 'REVIEW_CLOSED', resolutionReason: input.reason, resolvedAt: new Date(), version: { increment: 1 } } });
      await audit(tx, adminId, 'CORRECTION', id, 'CLOSE_CORRECTION', input.reason); return caseMeta(updated);
    });
  }
  private async correctionContext(tx: Prisma.TransactionClient, adminId: string, caseId: string, transactionId?: string) {
    const found = await tx.correctionCase.findUnique({ where: { id: caseId } });
    if (!found || (transactionId && found.transactionId !== transactionId)) throw new AppException(404, 'NOT_FOUND', 'Kasus tidak terkait transaksi.');
    const row = await lockTransaction(tx, found.transactionId);
    await lockRows(tx, 'CorrectionCase', [caseId]);
    await assignedScope(tx, adminId, 'CORRECTION', caseId);
    await this.requireGrant(tx, adminId, 'CORRECTION', caseId);
    if (row.status !== 'COMPLETED') throw new AppException(409, 'STATE_CONFLICT', 'Transaksi belum selesai.');
    if (!await tx.correctionEvidence.findFirst({ where: { caseId, purgedAt: null } })) throw new AppException(422, 'ACTION_NEEDS_DATA', 'Bukti koreksi wajib tersedia.');
    return { row, dispute: await tx.correctionCase.findUniqueOrThrow({ where: { id: caseId } }) };
  }
  async reverse(adminId: string, transactionId: string, input: z.infer<typeof ownershipCorrectionSchema>, key?: string) {
    return idempotent(this.db, adminId, 'ownership-correction:' + transactionId, key, input, async (tx) => {
      const { row, dispute } = await this.correctionContext(tx, adminId, input.caseId, transactionId);
      if (row.version !== input.expectedVersion || dispute.version !== input.expectedCaseVersion || row.correctedAt) throw new AppException(409, 'STATE_CONFLICT', 'Transaksi atau kasus sudah berubah.');
      const items = (row.snapshot as unknown as TransactionSnapshot).items;
      let blocked = false;
      for (const item of items) {
        const current = await tx.item.findUniqueOrThrow({ where: { id: item.id } });
        const original = await tx.ownershipTransfer.findUnique({ where: { transactionId_itemId: { transactionId, itemId: item.id } } });
        if (!original || current.currentOwnerId !== item.toUserId || current.reservedByTransactionId || current.archivedAt || await tx.ownershipTransfer.findFirst({ where: { itemId: item.id, transactionId: { not: transactionId }, effectiveAt: { gte: original.effectiveAt } } })) blocked = true;
      }
      if (blocked) {
        const updated = await tx.correctionCase.update({ where: { id: input.caseId }, data: { status: 'BLOCKED', resolution: 'GUARD_BLOCKED', resolutionReason: input.reason, resolvedAt: new Date(), version: { increment: 1 } } });
        await audit(tx, adminId, 'CORRECTION', dispute.id, 'OWNERSHIP_CORRECTION_BLOCKED', input.reason);
        return { case: caseMeta(updated), reversed: false };
      }
      for (const item of items) {
        await invalidateTutorials(tx, item.id, 'OWNERSHIP_CORRECTED');
      await tx.item.update({ where: { id: item.id }, data: { currentOwnerId: item.fromUserId, purchaseYear: null, originalPriceIdr: null, functionSummary: null, completenessSummary: null, issueSummary: null, itemRevision: { increment: 1 }, version: { increment: 1 } } });
        const listings = await tx.listing.findMany({ where: { itemId: item.id, status: { notIn: ['CLOSED', 'WITHDRAWN'] } }, select: { id: true } });
        await tx.listing.updateMany({ where: { id: { in: listings.map((l) => l.id) } }, data: { status: 'WITHDRAWN', closedAt: new Date(), publishedAt: null, version: { increment: 1 } } });
        await expireOffers(tx, { status: { in: ['PENDING', 'COUNTERED'] }, OR: [{ exchangeItemId: item.id }, { listingId: { in: listings.map((l) => l.id) } }] }, 'OWNERSHIP_CORRECTED');
        const original = await tx.passportEvent.findUnique({ where: { eventKey: 'transfer:' + row.id + ':' + item.id } });
        await event(tx, item.id, 'CORRECTION', 'TRANSACTION', row.id, new Date(), { kind: 'OWNERSHIP_REVERSED' }, input.caseId, 'ADMIN_AUTHORIZED', original?.id);
      }
      const contributions = await tx.impactEvent.findMany({ where: { sourceType: 'TRANSACTION', sourceId: transactionId } });
      const groups = new Map<string, { original: typeof contributions[number]; value: bigint }>();
      for (const e of contributions) {
        const slot = [e.metric, e.attributedUserId, e.itemId].join(':'); const group = groups.get(slot);
        if (group) group.value += e.delta; else groups.set(slot, { original: e, value: e.delta });
      }
      for (const { original, value } of groups.values()) if (value) await tx.impactEvent.create({ data: { eventKey: 'reverse:' + input.caseId + ':' + original.id, metric: original.metric, sourceType: original.sourceType, sourceId: original.sourceId, itemId: original.itemId, attributedUserId: original.attributedUserId, unit: original.unit, delta: -value, occurredAt: original.occurredAt, correctionOfId: original.id, reason: input.reason } });
      await tx.transaction.update({ where: { id: transactionId }, data: { correctedAt: new Date(), version: { increment: 1 } } });
      const updated = await tx.correctionCase.update({ where: { id: input.caseId }, data: { status: 'RESOLVED', resolution: 'OWNERSHIP_REVERSED', resolutionReason: input.reason, resolvedAt: new Date(), version: { increment: 1 } } });
      await audit(tx, adminId, 'CORRECTION', dispute.id, 'OWNERSHIP_REVERSED', input.reason, { transactionId }, { itemIds: items.map((i) => i.id) });
      return { case: caseMeta(updated), reversed: true };
    });
  }
  async adjustImpact(adminId: string, input: z.infer<typeof impactCorrectionSchema>, key?: string) {
    return idempotent(this.db, adminId, 'impact-adjust:' + input.caseId, key, input, async (tx) => {
      const { row } = await this.correctionContext(tx, adminId, input.caseId);
      if (row.version !== input.expectedVersion || row.correctedAt) throw new AppException(409, 'STATE_CONFLICT', 'Transaksi sudah berubah.');
      const value = BigInt(input.value); const snapshot = row.snapshot as unknown as TransactionSnapshot;
      const item = input.metric === 'ESTIMATED_TRANSFER_WEIGHT' ? snapshot.items.find((i) => i.id === input.itemId) : snapshot.items[0];
      if (!item || (input.metric === 'CONFIRMED_SALE_VALUE' && (row.type !== 'RESELL' || value <= 0n)) || (input.metric === 'ESTIMATED_TRANSFER_WEIGHT' && (value <= 0n || value > 100000000n)) || value > 1000000000000n) throw new AppException(400, 'INVALID_INPUT', 'Nominal atau Item tidak sesuai metrik.');
      const userId = input.metric === 'CONFIRMED_SALE_VALUE' ? row.sellerOrDonorId : item.fromUserId;
      for (const attributedUserId of [null, userId]) {
        const where = { sourceType: 'TRANSACTION', sourceId: row.id, metric: input.metric, attributedUserId, ...(input.metric === 'ESTIMATED_TRANSFER_WEIGHT' ? { itemId: item.id } : {}) };
        const existing = await tx.impactEvent.findMany({ where, orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }] });
        const old = existing.reduce((sum, e) => sum + e.delta, 0n);
        await tx.impactEvent.create({ data: { eventKey: 'adjust:' + input.caseId + ':' + row.version + ':' + input.metric + ':' + item.id + ':' + (attributedUserId ?? 'PLATFORM'), metric: input.metric, sourceType: 'TRANSACTION', sourceId: row.id, attributedUserId, itemId: input.metric === 'ESTIMATED_TRANSFER_WEIGHT' ? item.id : null, unit: input.metric === 'ESTIMATED_TRANSFER_WEIGHT' ? 'GRAM' : 'IDR', delta: value - old, occurredAt: existing[0]?.occurredAt ?? row.completedAt!, correctionOfId: existing[0]?.id, reason: input.reason } });
      }
      await tx.transaction.update({ where: { id: row.id }, data: { version: { increment: 1 } } });
      const originalPassport = await tx.passportEvent.findUnique({ where: { eventKey: 'transfer:' + row.id + ':' + item.id } });
      await event(tx, item.id, 'CORRECTION', 'TRANSACTION', row.id, new Date(), { kind: input.metric }, input.caseId + ':' + row.version, 'ADMIN_AUTHORIZED', originalPassport?.id);
      await audit(tx, adminId, 'CORRECTION', input.caseId, 'IMPACT_ADJUSTED', input.reason, undefined, { metric: input.metric, value: input.value });
      return { adjusted: true, version: row.version + 1 };
    });
  }
  async source(adminId: string, kind: 'ASSESSMENT' | 'REPAIR', id: string, input: z.infer<typeof sourceCorrectionSchema>, key?: string) {
    validId(id);
    return idempotent(this.db, adminId, 'source-correction:' + kind + ':' + id, key, input, async (tx) => {
      await this.correctionContext(tx, adminId, input.caseId);
      const source = kind === 'ASSESSMENT' ? await tx.assessment.findUnique({ where: { id } }) : await tx.repairRecord.findUnique({ where: { id } });
      if (!source) throw new AppException(404, 'NOT_FOUND', 'Sumber tidak ditemukan.');
      await scopeItem(tx, 'CORRECTION', input.caseId, source.itemId);
      await lockRows(tx, 'Item', [source.itemId]);
      const item = await tx.item.findUniqueOrThrow({ where: { id: source.itemId } });
      if (item.reservedByTransactionId || source.version !== input.expectedVersion) throw new AppException(409, 'STATE_CONFLICT', 'Item atau sumber sedang berubah.');
      if (kind === 'REPAIR') {
        const row = await tx.repairRecord.findUniqueOrThrow({ where: { id } });
        if ((row.status === 'VALID') === input.valid) throw new AppException(409, 'STATE_CONFLICT', 'Status sumber sama.');
        const updated = await tx.repairRecord.update({ where: { id }, data: { status: input.valid ? 'VALID' : 'VOID', voidReason: input.valid ? null : input.reason, version: { increment: 1 } } });
        await repairAdjustment(tx, row, updated.version, input.valid ? 1n : -1n, input.reason, new Date(), 'ADMIN_AUTHORIZED');
        await tx.repairCorrection.create({ data: { repairId: id, createdById: adminId, version: updated.version, kind: input.valid ? 'RESTORE' : 'VOID', reason: input.reason, beforeState: { status: row.status }, afterState: { status: updated.status } } });
      } else {
        const row = await tx.assessment.findUniqueOrThrow({ where: { id } });
        if (row.valid === input.valid) throw new AppException(409, 'STATE_CONFLICT', 'Status sumber sama.');
        await tx.assessment.update({ where: { id }, data: { valid: input.valid, version: { increment: 1 } } });
        const credited = await tx.impactEvent.findMany({ where: { metric: 'ITEMS_REVALUED', itemId: row.itemId, attributedUserId: null } });
        const totals = new Map<string, bigint>(); for (const e of credited) totals.set(e.sourceId, (totals.get(e.sourceId) ?? 0n) + e.delta);
        const next = await tx.assessment.findFirst({ where: { itemId: row.itemId, status: 'COMPLETE', valid: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
        for (const [sourceId, count] of totals) if (count && sourceId !== next?.id) {
          const old = await tx.assessment.findUniqueOrThrow({ where: { id: sourceId } }); const original = credited.find((e) => e.sourceId === sourceId)!;
          await contribution(tx, 'ASSESSMENT', old.id, old.itemId, old.createdById, 'ITEMS_REVALUED', original.occurredAt, -count, input.caseId + ':' + row.version, original.id, input.reason);
        }
        if (next && (totals.get(next.id) ?? 0n) === 0n) await contribution(tx, 'ASSESSMENT', next.id, next.itemId, next.createdById, 'ITEMS_REVALUED', next.createdAt, 1n, input.caseId + ':' + row.version, undefined, input.reason);
        const originalPassport = await tx.passportEvent.findUnique({ where: { eventKey: ['ASSESSMENT_CREATED', row.id, row.itemId, ''].join(':') } });
        await event(tx, row.itemId, 'CORRECTION', 'ASSESSMENT', row.id, new Date(), { kind: input.valid ? 'RESTORED' : 'INVALIDATED' }, input.caseId + ':' + row.version, 'ADMIN_AUTHORIZED', originalPassport?.id);
      }
      const listings = await tx.listing.findMany({ where: { itemId: source.itemId, status: { in: ['ACTIVE', 'PENDING_REVIEW'] } }, select: { id: true } });
      await tx.listing.updateMany({ where: { id: { in: listings.map((l) => l.id) } }, data: { status: 'PAUSED', publishedAt: null, version: { increment: 1 } } });
      await expireOffers(tx, { status: { in: ['PENDING', 'COUNTERED'] }, OR: [{ exchangeItemId: source.itemId }, { listingId: { in: listings.map((l) => l.id) } }] }, 'SOURCE_CORRECTED');
      await audit(tx, adminId, 'CORRECTION', input.caseId, 'SOURCE_' + (input.valid ? 'RESTORED' : 'INVALIDATED'), input.reason, undefined, { kind, id });
      return { id, valid: input.valid, version: source.version + 1 };
    });
  }
  async visibility(adminId: string, id: string, input: z.infer<typeof passportRestrictionSchema>, key?: string) {
    return idempotent(this.db, adminId, 'passport-visibility:' + id, key, input, async (tx) => {
      await assignedScope(tx, adminId, input.scopeType, input.caseId, true); await scopeItem(tx, input.scopeType, input.caseId, id);
      await lockRows(tx, 'Item', [id]); const item = await tx.item.findUniqueOrThrow({ where: { id } });
      if (item.passportVersion !== input.expectedVersion) throw new AppException(409, 'STATE_CONFLICT', 'Passport sudah berubah.');
      await tx.item.update({ where: { id }, data: { passportVisibility: input.visibility, passportVersion: { increment: 1 } } });
      await audit(tx, adminId, input.scopeType, input.caseId, 'PASSPORT_VISIBILITY', input.reason, { visibility: item.passportVisibility }, { itemId: id, visibility: input.visibility });
      return { itemId: id, visibility: input.visibility, version: item.passportVersion + 1 };
    });
  }
  async userStatus(adminId: string, id: string, input: z.infer<typeof versionReasonSchema>, suspend: boolean, key?: string) {
    validId(id);
    return idempotent(this.db, adminId, 'user-status:' + id, key, { ...input, suspend }, async (tx) => {
      const related = await tx.transaction.findMany({ where: { status: { in: [...activeTransactionStatuses] }, OR: [{ sellerOrDonorId: id }, { buyerOrRecipientId: id }] } });
      await lockRows(tx, 'User', [id, ...related.flatMap((t) => [t.sellerOrDonorId, t.buyerOrRecipientId])]);
      const row = await tx.user.findUnique({ where: { id } });
      if (!row || row.version !== input.expectedVersion || row.status === 'CLOSED' || row.role === 'ADMIN' || (row.status === 'SUSPENDED') === suspend) throw new AppException(409, 'STATE_CONFLICT', 'Status akun tidak dapat diubah.');
      const status = suspend ? 'SUSPENDED' : 'ACTIVE';
      await tx.user.update({ where: { id }, data: { status, version: { increment: 1 } } });
      if (suspend) {
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
        await closeForAccount(tx, id, 'ACCOUNT_SUSPENDED');
        await tx.listing.updateMany({ where: { ownerId: id, status: { in: ['ACTIVE', 'PENDING_REVIEW'] } }, data: { status: 'SUSPENDED', publishedAt: null, version: { increment: 1 } } });
        await expireOffers(tx, { status: { in: ['PENDING', 'COUNTERED'] }, OR: [{ bidderId: id }, { listing: { ownerId: id } }] }, 'ACCOUNT_SUSPENDED');
      }
      await audit(tx, adminId, 'USER', id, suspend ? 'SUSPEND_USER' : 'RELEASE_USER', input.reason, { status: row.status }, { status });
      return { id, status, version: row.version + 1 };
    });
  }
}
