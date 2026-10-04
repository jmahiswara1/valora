import { AppException } from '../../shared/http.js';
import { validId, requiredConfirmations } from '../../shared/transactions.js';
import type { Prisma, Transaction } from '../../generated/prisma/client.js';
import type { TransactionDto, TransactionSnapshot } from '@valora/contracts';
import type { PageQuery } from './shared.js';

export function paging(query: PageQuery, statuses: readonly string[]) {
  if (query.status && !statuses.includes(query.status)) throw new AppException(400, 'INVALID_INPUT', 'Status filter tidak dikenal.');
  if (!query.cursor) return {};
  try {
    const value = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')) as { id: string; at: string; status?: string };
    validId(value.id);
    const at = new Date(value.at);
    if (Number.isNaN(at.getTime()) || value.status !== query.status) throw new Error('invalid');
    return { OR: [{ acceptedAt: { lt: at } }, { acceptedAt: at, id: { lt: value.id } }] };
  } catch { throw new AppException(400, 'INVALID_INPUT', 'Cursor tidak sesuai filter.'); }
}

export async function transactionDto(tx: Prisma.TransactionClient, row: Transaction): Promise<TransactionDto> {
  const [confirmations, cancellations, disputes, conversation, corrections] = await Promise.all([
    tx.handoverConfirmation.findMany({ where: { transactionId: row.id }, orderBy: [{ confirmedAt: 'asc' }, { id: 'asc' }] }),
    tx.cancellationRequest.findMany({ where: { transactionId: row.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    tx.disputeCase.findMany({ where: { transactionId: row.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    tx.conversation.findFirst({ where: { listingId: row.listingId, participantAId: { in: [row.sellerOrDonorId, row.buyerOrRecipientId] }, participantBId: { in: [row.sellerOrDonorId, row.buyerOrRecipientId] } } }),
    tx.correctionCase.findMany({ where: { transactionId: row.id }, orderBy: { createdAt: 'desc' } }),
  ]);
  return {
    id: row.id, listingId: row.listingId, offerId: row.offerId, type: row.type, status: row.status,
    sellerOrDonorId: row.sellerOrDonorId, buyerOrRecipientId: row.buyerOrRecipientId, finalPriceIdr: row.finalPriceIdr === null ? null : Number(row.finalPriceIdr),
    snapshot: row.snapshot as unknown as TransactionSnapshot, acceptedAt: row.acceptedAt.toISOString(), targetHandoverAt: row.targetHandoverAt.toISOString(), overdueAt: row.overdueAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null, cancelledAt: row.cancelledAt?.toISOString() ?? null, resolutionOrigin: row.resolutionOrigin, correctedAt: row.correctedAt?.toISOString() ?? null, version: row.version,
    confirmations: confirmations.map((c) => ({ id: c.id, actorId: c.actorId, itemId: c.itemId, kind: c.kind as 'HANDED_OVER' | 'RECEIVED', confirmedAt: c.confirmedAt.toISOString(), source: c.source })),
    cancellations: cancellations.map((c) => ({ id: c.id, requestedById: c.requestedById, reason: c.reason, status: c.status, endReason: c.endReason, createdAt: c.createdAt.toISOString(), respondedAt: c.respondedAt?.toISOString() ?? null })),
    disputes: disputes.map((c) => ({ id: c.id, transactionId: c.transactionId, status: c.status, assignedAdminId: c.assignedAdminId, reason: c.reason, resolution: c.resolution, resolutionReason: c.resolutionReason, version: c.version, createdAt: c.createdAt.toISOString(), resolvedAt: c.resolvedAt?.toISOString() ?? null })),
    corrections: corrections.map((c) => ({ id: c.id, transactionId: c.transactionId, status: c.status, assignedAdminId: c.assignedAdminId, version: c.version, resolution: c.resolution, createdAt: c.createdAt.toISOString(), resolvedAt: c.resolvedAt?.toISOString() ?? null })),
    conversationId: conversation?.id ?? null, requiredConfirmations: requiredConfirmations(row),
  };
}
