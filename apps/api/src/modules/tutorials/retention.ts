import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { serial } from '../../shared/transactions.js';
import { RetentionService } from '../retention/service.js';
import { transactionUsingItem } from '../../shared/exchange.js';

import { purgeTutorialPrivate } from './purge.js';
@Injectable()
export class TutorialRetentionService {
  constructor(private readonly db: DatabaseService, private readonly retention: RetentionService) {}
  async run(now = new Date()) {
    await serial(this.db, async tx => {
      const pending = await tx.repairTutorialInteraction.findMany({ where: { status: 'PENDING', createdAt: { lt: new Date(now.getTime() - 90000) } }, take: 200, select: { id: true } });
      if (pending.length) await tx.repairTutorialInteraction.updateMany({ where: { id: { in: pending.map(p => p.id) }, status: 'PENDING' }, data: { status: 'UNAVAILABLE', failureReason: 'LEASE_EXPIRED', answeredAt: now, reply: { source: 'UNAVAILABLE', intent: 'CLARIFY', blocks: [], observations: [], questions: [], reason: 'LEASE_EXPIRED' } } });
      await tx.repairTutorialAiLease.deleteMany({ where: { expiresAt: { lte: now } } });
    });
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.db.repairTutorialSession.findMany({ where: { closedAt: { lte: new Date(now.getTime() - 90 * 86400000) }, purgedAt: null, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: 50, select: { id: true, createdById: true } });
      if (!rows.length) break; cursor = rows.at(-1)!.id;
      for (const row of rows) await serial(this.db, async tx => {
        // Existing account hold policy conservatively also protects all related item cases.
        if (await this.retention.blockedAccount(tx, row.createdById, now)) return;
        const fresh = await tx.repairTutorialSession.findUnique({ where: { id: row.id } });
        if (!fresh?.closedAt || fresh.purgedAt || fresh.closedAt.getTime() > now.getTime() - 90 * 86400000) return;
        const related = await tx.transaction.findMany({ where: transactionUsingItem(fresh.itemId), select: { id: true } });
        const ids = related.map(t => t.id);
        const disputes = await tx.disputeCase.findMany({ where: { transactionId: { in: ids } } });
        for (const c of disputes) if (['OPEN', 'IN_REVIEW'].includes(c.status) || (c.retentionHoldUntil && c.retentionHoldUntil > now) || await this.retention.blockedScope(tx, 'DISPUTE', c.id, now)) return;
        const corrections = await tx.correctionCase.findMany({ where: { transactionId: { in: ids } } });
        for (const c of corrections) if (['OPEN', 'IN_REVIEW'].includes(c.status) || await this.retention.blockedScope(tx, 'CORRECTION', c.id, now)) return;
        const listings = await tx.listing.findMany({ where: { itemId: fresh.itemId }, select: { id: true } });
        const reports = await tx.report.findMany({ where: { OR: [{ targetType: 'TRANSACTION', targetId: { in: ids } }, { targetType: 'LISTING', targetId: { in: listings.map(l => l.id) } }] } });
        for (const r of reports) if (['OPEN', 'IN_REVIEW'].includes(r.status) || (r.retentionHoldUntil && r.retentionHoldUntil > now) || await this.retention.blockedScope(tx, 'REPORT', r.id, now)) return;
        await purgeTutorialPrivate(tx, [row.id], now);
      });
    }
  }
}
