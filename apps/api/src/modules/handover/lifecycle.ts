import type { Prisma } from '../../generated/prisma/client.js';

export async function invalidateHandover(tx: Prisma.TransactionClient, transactionId: string, endReason: string, actorId: string | null = null, now = new Date()) {
  const rows = await tx.handoverProposal.findMany({ where: { transactionId, status: 'PENDING' } });
  for (const row of rows) {
    await tx.handoverProposal.update({ where: { id: row.id }, data: { status: 'INVALIDATED', endReason, respondedAt: now } });
    await tx.handoverEvent.create({ data: { transactionId, proposalId: row.id, actorId, type: 'HANDOVER_INVALIDATED', occurredAt: now } });
  }
}
