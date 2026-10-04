import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { serial } from '../../shared/transactions.js';
import { event, assessmentEvents, repairEvents, repairAdjustment } from './ledger.js';

@Injectable()
export class LedgerService implements OnModuleInit {
  constructor(private readonly db: DatabaseService) {}
  async backfill(itemIds?: string[]) {
    const items = await this.db.item.findMany({ where: itemIds ? { id: { in: itemIds } } : {}, select: { id: true, createdAt: true } });
    for (const item of items) await serial(this.db, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${item.id}::uuid FOR UPDATE`;
      await event(tx, item.id, 'REGISTERED', 'ITEM', item.id, item.createdAt);
      const assessments = await tx.assessment.findMany({ where: { itemId: item.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      for (const row of assessments) await assessmentEvents(tx, row);
      const repairs = await tx.repairRecord.findMany({ where: { itemId: item.id } });
      for (const row of repairs) {
        const changes = await tx.repairCorrection.findMany({ where: { repairId: row.id }, orderBy: { version: 'asc' } });
        const firstState = changes[0]?.beforeState as { performedAt?: string } | undefined;
        const original = { ...row, performedAt: firstState?.performedAt ? new Date(firstState.performedAt) : row.performedAt };
        await repairEvents(tx, original);
        for (const change of changes) {
          if (change.kind === 'VOID' || change.kind === 'RESTORE') await repairAdjustment(tx, row, change.version, change.kind === 'VOID' ? -1n : 1n, change.reason, change.createdAt);
          else {
            const root = await tx.passportEvent.findUnique({ where: { eventKey: ['REPAIR_RECORDED', row.id, row.itemId, ''].join(':') } });
            await event(tx, row.itemId, 'CORRECTION', 'REPAIR', row.id, change.createdAt, { kind: 'CORRECTED' }, 'v' + change.version, 'USER_REPORTED', root?.id);
          }
        }
        if (row.status === 'VOID' && !changes.some((c) => c.kind === 'VOID')) await repairAdjustment(tx, row, row.version, -1n, row.voidReason ?? 'Historical void');
      }
      const revisions = await tx.listingRevision.findMany({ where: { itemId: item.id }, include: { reviews: { where: { decision: 'APPROVE' }, orderBy: { createdAt: 'asc' }, take: 1 } } });
      for (const revision of revisions) if (revision.reviews[0]) await event(tx, item.id, 'LISTED', 'LISTING_REVISION', revision.id, revision.reviews[0].createdAt, { type: (await tx.listing.findUniqueOrThrow({ where: { id: revision.listingId } })).type }, '', 'SYSTEM_RECORDED');
    });
    return { items: items.length };
  }
  async onModuleInit() {
    if (await this.db.maintenanceRun.findFirst({ where: { job: 'STAGE5_LEDGER_BACKFILL', status: 'COMPLETED' } })) return;
    const run = await this.db.maintenanceRun.create({ data: { job: 'STAGE5_LEDGER_BACKFILL' } });
    try { const counts = await this.backfill(); await this.db.maintenanceRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', counts, completedAt: new Date() } }); }
    catch (error) { await this.db.maintenanceRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: 'Ledger backfill failed', completedAt: new Date() } }); throw error; }
  }
}
