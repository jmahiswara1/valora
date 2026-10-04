import type { Prisma } from '../../generated/prisma/client.js';
import type { EvidenceDto, TransactionSnapshot, MediaTicketInput, EvidenceInput, ResolveDisputeInput } from '@valora/contracts';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { MediaService } from "../media/service.js";
import { TransactionsService } from "../transactions/service.js";
import { idempotent, lockTransaction, mutable, lockRows, json, validId, requiredConfirmations } from '../../shared/transactions.js';
import { AppException } from '../../shared/http.js';
import { transactionDto } from '../transactions/helpers.js';
import { caseForParticipant, assignedCase } from './helpers.js';

async function evidenceList(tx: Prisma.TransactionClient, caseId: string): Promise<EvidenceDto[]> {
  const rows = await tx.caseEvidence.findMany({ where: { caseId }, include: { media: { where: { deletedAt: null } } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  return rows.map((r) => ({ id: r.id, caseId, submittedById: r.submittedById, note: r.note, message: r.messageSnapshot as EvidenceDto['message'], media: r.media.map((m) => ({ id: m.id, mime: m.mime, bytes: m.bytes, orderIndex: m.orderIndex, processedAt: m.processedAt.toISOString() })), createdAt: r.createdAt.toISOString() }));
}

function metadata(row: Awaited<ReturnType<typeof caseForParticipant>>, includeReason = false) {
  return { id: row.id, transactionId: row.transactionId, status: row.status, assignedAdminId: row.assignedAdminId, ...(includeReason ? { reason: row.reason, resolutionReason: row.resolutionReason } : {}), resolution: row.resolution, version: row.version, createdAt: row.createdAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null, transactionVersion: row.transaction.version, transactionTitle: (row.transaction.snapshot as unknown as TransactionSnapshot).items[0].title, overdueAt: row.transaction.overdueAt?.toISOString() ?? null };
}

@Injectable()
export class DisputesService {
  constructor(private readonly db: DatabaseService, private readonly media: MediaService, private readonly transactions: TransactionsService) {}

  async overdueCase(actorId: string, transactionId: string, input: { expectedVersion: number; reason: string }, key?: string) {
    return idempotent(this.db, actorId, 'overdue-case:' + transactionId, key, input, async (tx) => {
      const row = await lockTransaction(tx, transactionId); mutable(row, input.expectedVersion);
      if (!row.overdueAt || row.status === 'DISPUTED' || [row.sellerOrDonorId, row.buyerOrRecipientId].includes(actorId)) throw new AppException(409, 'STATE_CONFLICT', 'Transaksi belum memerlukan tindak lanjut ini atau admin merupakan peserta.');
      const record = await tx.disputeCase.create({ data: { transactionId, openedById: actorId, assignedAdminId: actorId, reason: input.reason, status: 'IN_REVIEW' } });
      await tx.caseEvidence.create({ data: { caseId: record.id, submittedById: actorId, note: 'Tindak lanjut admin atas target serah terima terlewati: ' + input.reason } });
      await tx.transaction.update({ where: { id: transactionId }, data: { status: 'DISPUTED', version: { increment: 1 } } });
      await tx.adminAction.create({ data: { adminId: actorId, targetType: 'DISPUTE', targetId: record.id, action: 'OPEN_OVERDUE_CASE', reason: input.reason } });
      return { caseId: record.id };
    });
  }
  async get(actorId: string, caseId: string) {
    const row = await caseForParticipant(this.db, actorId, caseId);
    return { ...metadata(row, true), evidence: await evidenceList(this.db, caseId) };
  }
  async ticket(actorId: string, caseId: string, input: MediaTicketInput) {
    const row = await caseForParticipant(this.db, actorId, caseId);
    if (row.status === 'RESOLVED') throw new AppException(409, 'STATE_CONFLICT', 'Kasus sudah ditutup.');
    return this.media.ticket(actorId, input, row.transaction.itemId, caseId);
  }
  async evidence(actorId: string, caseId: string, input: EvidenceInput, key?: string) {
    return idempotent(this.db, actorId, 'evidence:' + caseId, key, input, async (tx) => {
      const ref = await caseForParticipant(tx, actorId, caseId);
      await lockTransaction(tx, ref.transactionId); await lockRows(tx, 'DisputeCase', [caseId]);
      const row = await caseForParticipant(tx, actorId, caseId);
      if (row.status === 'RESOLVED') throw new AppException(409, 'STATE_CONFLICT', 'Kasus sudah ditutup.');
      let messageSnapshot: Prisma.InputJsonValue | undefined;
      if (input.messageId) {
        const message = await tx.message.findUnique({ where: { id: input.messageId }, include: { conversation: true } });
        const parties = [row.transaction.sellerOrDonorId, row.transaction.buyerOrRecipientId];
        if (!message || message.deletedAt || message.conversation.listingId !== row.transaction.listingId || !parties.includes(message.conversation.participantAId) || !parties.includes(message.conversation.participantBId)) throw new AppException(404, 'NOT_FOUND', 'Pesan tidak berasal dari percakapan transaksi ini.');
        messageSnapshot = json({ id: message.id, senderId: message.senderId, body: message.body, sentAt: message.sentAt.toISOString() });
      }
      const tickets = await tx.uploadTicket.findMany({ where: { id: { in: input.ticketIds }, userId: actorId, caseId, purpose: 'CASE_EVIDENCE', status: 'UPLOADED', expiresAt: { gt: new Date() } } });
      if (tickets.length !== input.ticketIds.length || tickets.some((t) => !t.storageKey || !t.actualBytes || !t.actualMime)) throw new AppException(400, 'MEDIA_INVALID', 'Foto bukti belum siap atau berasal dari kasus lain.');
      const record = await tx.caseEvidence.create({ data: { caseId, submittedById: actorId, note: input.note, messageId: input.messageId, messageSnapshot } });
      for (const [orderIndex, ticket] of tickets.entries()) {
        const claimed = await tx.uploadTicket.updateMany({ where: { id: ticket.id, status: 'UPLOADED', caseId, userId: actorId }, data: { status: 'CONSUMED', consumedAt: new Date() } });
        if (claimed.count !== 1) throw new AppException(409, 'STATE_CONFLICT', 'Foto bukti telah digunakan.');
        await tx.mediaAsset.create({ data: { itemId: row.transaction.itemId, uploadedById: actorId, caseId, evidenceId: record.id, storageKey: ticket.storageKey!, mime: ticket.actualMime!, bytes: ticket.actualBytes!, orderIndex, processedAt: ticket.uploadedAt! } });
      }
      return (await evidenceList(tx, caseId)).find((e) => e.id === record.id)!;
    });
  }
  async queue(query: { cursor?: string; limit: number; status?: string }) {
    if (query.status && !['OPEN', 'IN_REVIEW', 'RESOLVED'].includes(query.status)) throw new AppException(400, 'INVALID_INPUT', 'Status kasus tidak dikenal.');
    let cursor: Prisma.DisputeCaseWhereInput = {};
    if (query.cursor) {
      try {
        const c = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')) as { id: string; at: string; status?: string };
        validId(c.id); const at = new Date(c.at); if (Number.isNaN(at.getTime()) || c.status !== query.status) throw new Error('invalid');
        cursor = { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: c.id } }] };
      } catch { throw new AppException(400, 'INVALID_INPUT', 'Cursor kasus tidak sesuai.'); }
    }
    const rows = await this.db.disputeCase.findMany({ where: { AND: [cursor], status: query.status ?? { in: ['OPEN', 'IN_REVIEW'] } }, include: { transaction: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit + 1 });
    const page = rows.slice(0, query.limit); const last = page.at(-1);
    const overdue = await this.db.transaction.findMany({ where: { status: { in: ['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED'] }, overdueAt: { not: null } }, select: { id: true, version: true, targetHandoverAt: true, overdueAt: true, snapshot: true }, take: 50, orderBy: { targetHandoverAt: 'asc' } });
    return { data: page.map((r) => metadata(r)), meta: { nextCursor: rows.length > query.limit && last ? Buffer.from(JSON.stringify({ id: last.id, at: last.createdAt.toISOString(), status: query.status })).toString('base64url') : null, overdue: overdue.map((r) => ({ id: r.id, version: r.version, title: (r.snapshot as unknown as TransactionSnapshot).items[0].title, targetHandoverAt: r.targetHandoverAt.toISOString(), overdueAt: r.overdueAt!.toISOString() })) } };
  }
  async adminDetail(actorId: string, caseId: string) {
    validId(caseId);
    const row = await this.db.disputeCase.findUnique({ where: { id: caseId }, include: { transaction: true } });
    if (!row) throw new AppException(404, 'NOT_FOUND', 'Kasus tidak ditemukan.');
    return { ...metadata(row, row.assignedAdminId === actorId), transaction: row.assignedAdminId === actorId ? await transactionDto(this.db, row.transaction) : null };
  }
  async claim(actorId: string, caseId: string, expectedVersion: number, key?: string) {
    return idempotent(this.db, actorId, 'case-claim:' + caseId, key, { expectedVersion }, async (tx) => {
      validId(caseId); const ref = await tx.disputeCase.findUnique({ where: { id: caseId } });
      if (!ref) throw new AppException(404, 'NOT_FOUND', 'Kasus tidak ditemukan.');
      const transaction = await lockTransaction(tx, ref.transactionId); await lockRows(tx, 'DisputeCase', [caseId]);
      if ([transaction.sellerOrDonorId, transaction.buyerOrRecipientId].includes(actorId)) throw new AppException(403, 'FORBIDDEN', 'Peserta transaksi tidak dapat memutuskan kasusnya sendiri.');
      const row = await tx.disputeCase.findUniqueOrThrow({ where: { id: caseId } });
      if (row.version !== expectedVersion || row.status === 'RESOLVED' || (row.assignedAdminId && row.assignedAdminId !== actorId)) throw new AppException(409, 'STATE_CONFLICT', 'Kasus sudah diambil atau diproses admin lain.');
      await tx.disputeCase.update({ where: { id: caseId }, data: { assignedAdminId: actorId, status: 'IN_REVIEW', version: { increment: 1 } } });
      await tx.adminAction.create({ data: { adminId: actorId, targetType: 'DISPUTE', targetId: caseId, action: 'CLAIM_CASE', reason: 'Mengambil penugasan kasus sengketa.' } });
      return { claimed: true };
    });
  }
  async grant(actorId: string, caseId: string, kind: 'CHAT' | 'EVIDENCE', reason: string, key?: string) {
    return idempotent(this.db, actorId, 'case-access:' + caseId + ':' + kind, key, { reason }, async (tx) => {
      await assignedCase(tx, actorId, caseId);
      const expiresAt = new Date(Date.now() + 5 * 60000);
      const grant = await tx.caseAccessGrant.create({ data: { caseId, adminId: actorId, kind, reason, expiresAt } });
      await tx.adminAction.create({ data: { adminId: actorId, targetType: 'DISPUTE', targetId: caseId, action: 'ACCESS_' + kind, reason, afterState: json({ grantId: grant.id, expiresAt: expiresAt.toISOString() }) } });
      return { grantId: grant.id, expiresAt: expiresAt.toISOString() };
    });
  }
  async adminEvidence(actorId: string, caseId: string) { await assignedCase(this.db, actorId, caseId, 'EVIDENCE'); return evidenceList(this.db, caseId); }
  async adminMessages(actorId: string, caseId: string, before?: string) {
    const row = await assignedCase(this.db, actorId, caseId, 'CHAT');
    let sequence: number | undefined;
    if (before) { sequence = Number(before); if (!Number.isSafeInteger(sequence) || sequence < 1) throw new AppException(400, 'INVALID_INPUT', 'Cursor pesan tidak valid.'); }
    const parties = [row.transaction.sellerOrDonorId, row.transaction.buyerOrRecipientId];
    const messages = await this.db.message.findMany({ where: { conversation: { listingId: row.transaction.listingId, participantAId: { in: parties }, participantBId: { in: parties } }, deletedAt: null, ...(sequence ? { sequence: { lt: sequence } } : {}) }, orderBy: { sequence: 'desc' }, take: 31 });
    const page = messages.slice(0, 30);
    return { data: page.reverse().map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, sentAt: m.sentAt.toISOString() })), meta: { nextCursor: messages.length > 30 ? String(page[0].sequence) : null } };
  }
  async resolve(actorId: string, transactionId: string, input: ResolveDisputeInput, key?: string) {
    return idempotent(this.db, actorId, 'resolve:' + transactionId, key, input, async (tx) => {
      const row = await lockTransaction(tx, transactionId); mutable(row, input.expectedVersion);
      await lockRows(tx, 'DisputeCase', [input.caseId]);
      const record = await assignedCase(tx, actorId, input.caseId, 'EVIDENCE');
      if (record.transactionId !== transactionId || row.status !== 'DISPUTED' || record.status === 'RESOLVED') throw new AppException(409, 'STATE_CONFLICT', 'Kasus tidak sesuai transaksi aktif.');
      if (await tx.caseEvidence.count({ where: { id: { in: [...new Set(input.evidenceIds)] }, caseId: input.caseId } }) !== input.evidenceIds.length) throw new AppException(400, 'INVALID_INPUT', 'Referensi bukti tidak sesuai kasus.');
      if (input.decision === 'CANCEL') await this.transactions.cancel(tx, row);
      else if (input.decision === 'COMPLETE_AUTHORIZED') await this.transactions.complete(tx, row, 'ADMIN_AUTHORIZED');
      else {
        const confirmations = await tx.handoverConfirmation.count({ where: { transactionId } });
        const status = confirmations ? 'ONE_SIDE_CONFIRMED' : 'AWAITING_HANDOVER';
        const continued = await tx.transaction.update({ where: { id: transactionId }, data: { status, version: { increment: 1 } } });
        if (confirmations === requiredConfirmations(row).length) await this.transactions.complete(tx, continued, 'USER_CONFIRMED');
      }
      await tx.disputeCase.update({ where: { id: input.caseId }, data: { status: 'RESOLVED', resolution: input.decision, resolutionReason: input.reason, resolvedAt: new Date(), version: { increment: 1 } } });
      await tx.adminAction.create({ data: { adminId: actorId, targetType: 'DISPUTE', targetId: input.caseId, action: input.decision, reason: input.reason, beforeState: json({ transactionId, status: row.status }), afterState: json({ evidenceIds: input.evidenceIds, decision: input.decision }) } });
      return transactionDto(tx, await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } }));
    });
  }
}
