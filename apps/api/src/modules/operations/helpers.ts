import type { Prisma } from '../../generated/prisma/client.js';
import { validId, json } from '../../shared/transactions.js';
import { AppException } from '../../shared/http.js';

export type OperationsScope = 'REPORT' | 'DISPUTE' | 'CORRECTION';

export async function assignedScope(tx: Prisma.TransactionClient, adminId: string, type: OperationsScope, id: string, allowResolved = false) {
  validId(id);
  const row = type === 'REPORT' ? await tx.report.findUnique({ where: { id } }) : type === 'DISPUTE' ? await tx.disputeCase.findUnique({ where: { id } }) : await tx.correctionCase.findUnique({ where: { id } });
  if (!row || row.assignedAdminId !== adminId) throw new AppException(403, 'CASE_NOT_ASSIGNED', 'Kasus harus ditugaskan kepadamu.');
  if (!allowResolved && !['OPEN', 'IN_REVIEW'].includes(row.status)) throw new AppException(409, 'STATE_CONFLICT', 'Kasus sudah ditutup.');
  return row;
}

export async function scopeTransactionIds(tx: Prisma.TransactionClient, type: OperationsScope, id: string): Promise<string[]> {
  if (type === 'CORRECTION') { const row = await tx.correctionCase.findUnique({ where: { id } }); return row ? [row.transactionId] : []; }
  if (type === 'DISPUTE') { const row = await tx.disputeCase.findUnique({ where: { id } }); return row ? [row.transactionId] : []; }
  const row = await tx.report.findUnique({ where: { id } }); if (!row) return [];
  if (row.targetType === 'TRANSACTION') return [row.targetId];
  let listingId = row.targetType === 'LISTING' ? row.targetId : null;
  if (row.targetType === 'MESSAGE') listingId = (await tx.message.findUnique({ where: { id: row.targetId }, include: { conversation: true } }))?.conversation.listingId ?? null;
  if (!listingId) return [];
  return (await tx.transaction.findMany({ where: { listingId }, select: { id: true } })).map((t) => t.id);
}

export async function scopeItem(tx: Prisma.TransactionClient, type: OperationsScope, scopeId: string, itemId: string) {
  const ids = await scopeTransactionIds(tx, type, scopeId);
  if (await tx.transaction.findFirst({ where: { id: { in: ids }, OR: [{ itemId }, { offeredItemId: itemId }] } })) return;
  if (type === 'REPORT') {
    const report = await tx.report.findUnique({ where: { id: scopeId } });
    if (report?.targetType === 'LISTING' && await tx.listing.findFirst({ where: { id: report.targetId, itemId } })) return;
  }
  throw new AppException(403, 'FORBIDDEN', 'Item tidak terkait kasus.');
}

export async function audit(tx: Prisma.TransactionClient, adminId: string, targetType: string, targetId: string, action: string, reason: string, before?: unknown, after?: unknown, reportId?: string) {
  await tx.adminAction.create({ data: { adminId, targetType, targetId, action, reason, reportId, ...(before === undefined ? {} : { beforeState: json(before) }), ...(after === undefined ? {} : { afterState: json(after) }) } });
}
