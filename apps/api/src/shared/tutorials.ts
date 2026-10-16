import type { Prisma } from '../generated/prisma/client.js';
import { AppException } from './http.js';

export async function assertNoStartedTutorial(tx: Prisma.TransactionClient, itemId: string, exceptId?: string) {
  if (await tx.repairTutorialSession.findFirst({ where: { itemId, startedAt: { not: null }, closedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } })) throw new AppException(409, 'STATE_CONFLICT', 'Selesaikan atau tutup panduan perawatan & perbaikan barang ini dahulu.');
}
export async function invalidateTutorials(tx: Prisma.TransactionClient, itemId: string, reason = 'ITEM_CHANGED', exceptId?: string) {
  await tx.repairTutorialSession.updateMany({ where: { itemId, closedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) }, data: { state: 'INVALIDATED', reason, closedAt: new Date(), version: { increment: 1 } } });
}
export async function authorizeTutorialUpload(tx: Prisma.TransactionClient, actorId: string, id: string) {
  const row = await tx.repairTutorialSession.findFirst({ where: { id, createdById: actorId }, include: { item: true } });
  if (!row) throw new AppException(404, 'NOT_FOUND', 'Panduan tidak ditemukan.');
  if (row.closedAt || row.purgedAt || row.item.currentOwnerId !== actorId || row.item.archivedAt || row.item.reservedByTransactionId || row.item.itemRevision !== row.sourceItemRevision || !['PREFLIGHT', 'IN_PROGRESS', 'PAUSED', 'REVIEW'].includes(row.state)) throw new AppException(409, 'STATE_CONFLICT', 'Sesi tidak menerima foto baru.');
  return row;
}
