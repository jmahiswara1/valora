import type { Prisma, Assessment, RepairRecord } from '../../generated/prisma/client.js';
import { json } from '../../shared/transactions.js';

export const impactMetrics = ['ITEMS_REVALUED', 'REPAIRS_RECORDED', 'COMPLETED_TRANSFERS', 'ESTIMATED_TRANSFER_WEIGHT', 'CONFIRMED_SALE_VALUE'] as const;

export async function event(tx: Prisma.TransactionClient, itemId: string, type: string, sourceType: string, sourceId: string, at: Date, payload: unknown = {}, suffix = '', origin = 'USER_REPORTED', correctionOfId?: string) {
  const eventKey = [type, sourceId, itemId, suffix].join(':');
  return tx.passportEvent.upsert({ where: { eventKey }, update: {}, create: { eventKey, itemId, eventType: type, sourceType, sourceId, origin, publicPayload: json(payload), occurredAt: at, correctionOfId } });
}

export async function contribution(tx: Prisma.TransactionClient, sourceType: string, sourceId: string, itemId: string, userId: string, metric: string, at: Date, delta = 1n, suffix = '', correctionOfId?: string, reason?: string) {
  for (const attributedUserId of [null, userId]) {
    const eventKey = [metric, sourceId, attributedUserId ?? 'PLATFORM', suffix].join(':');
    await tx.impactEvent.upsert({ where: { eventKey }, update: {}, create: { eventKey, sourceType, sourceId, itemId, attributedUserId, metric, occurredAt: at, delta, unit: 'COUNT', correctionOfId, reason } });
  }
}

export async function assessmentEvents(tx: Prisma.TransactionClient, row: Assessment) {
  await event(tx, row.itemId, 'ASSESSMENT_CREATED', 'ASSESSMENT', row.id, row.createdAt, { status: row.status });
  // The item lock held by the caller makes selecting the first valid assessment atomic.
  const first = await tx.assessment.findFirst({ where: { itemId: row.itemId, status: 'COMPLETE', valid: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  if (first?.id === row.id) {
    const sum = await tx.impactEvent.aggregate({ where: { itemId: row.itemId, metric: 'ITEMS_REVALUED', attributedUserId: null }, _sum: { delta: true } });
    const hasSource = await tx.impactEvent.findFirst({ where: { sourceId: row.id, metric: 'ITEMS_REVALUED' } });
    if ((sum._sum.delta ?? 0n) === 0n && !hasSource) await contribution(tx, 'ASSESSMENT', row.id, row.itemId, row.createdById, 'ITEMS_REVALUED', row.createdAt);
  }
}

export async function repairEvents(tx: Prisma.TransactionClient, row: RepairRecord) {
  await event(tx, row.itemId, 'REPAIR_RECORDED', 'REPAIR', row.id, row.performedAt);
  await contribution(tx, 'REPAIR', row.id, row.itemId, row.createdById, 'REPAIRS_RECORDED', row.performedAt);
}

export async function repairAdjustment(tx: Prisma.TransactionClient, row: RepairRecord, version: number, delta: bigint, reason: string, recordedAt = new Date(), origin = 'USER_REPORTED') {
  const original = await tx.impactEvent.findFirst({ where: { sourceType: 'REPAIR', sourceId: row.id, correctionOfId: null, attributedUserId: null } });
  await contribution(tx, 'REPAIR', row.id, row.itemId, row.createdById, 'REPAIRS_RECORDED', original?.occurredAt ?? row.performedAt, delta, 'v' + version, original?.id, reason);
  const originalPassport = await tx.passportEvent.findUnique({ where: { eventKey: ['REPAIR_RECORDED', row.id, row.itemId, ''].join(':') } });
  await event(tx, row.itemId, 'CORRECTION', 'REPAIR', row.id, recordedAt, { kind: delta < 0n ? 'VOID' : 'RESTORED' }, 'v' + version, origin, originalPassport?.id);
}
