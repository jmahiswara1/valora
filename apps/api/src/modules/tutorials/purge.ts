import { Prisma } from '../../generated/prisma/client.js';
export async function purgeTutorialPrivate(tx: Prisma.TransactionClient, ids: string[], now: Date, closeActive = false) {
  if (!ids.length) return;
  const photos = await tx.repairTutorialPhoto.findMany({ where: { sessionId: { in: ids }, deletedAt: null } });
  for (const p of photos) await tx.storageDeletion.upsert({ where: { storageKey: p.storageKey }, update: {}, create: { storageKey: p.storageKey } });
  await tx.repairTutorialPhoto.updateMany({ where: { sessionId: { in: ids }, deletedAt: null }, data: { deletedAt: now } });
  await tx.repairTutorialInteraction.updateMany({ where: { sessionId: { in: ids } }, data: { question: '', photoIds: [], reply: Prisma.DbNull, failureReason: 'RETENTION_PURGED', status: 'UNAVAILABLE' } });
  await tx.repairTutorialAiLease.deleteMany({ where: { sessionId: { in: ids } } });
  if (closeActive) await tx.repairTutorialSession.updateMany({ where: { id: { in: ids }, closedAt: null }, data: { state: 'INVALIDATED', reason: 'ACCOUNT_CLOSED', closedAt: now, version: { increment: 1 } } });
  await tx.repairTutorialSession.updateMany({ where: { id: { in: ids } }, data: { problem: '', preflight: {}, draft: {}, purgedAt: now } });
  const pending = await tx.uploadTicket.findMany({ where: { tutorialSessionId: { in: ids }, status: { not: 'CONSUMED' } } });
  for (const t of pending) { if (t.storageKey) await tx.storageDeletion.upsert({ where: { storageKey: t.storageKey }, update: {}, create: { storageKey: t.storageKey } }); await tx.uploadTicket.delete({ where: { id: t.id } }); }
}
