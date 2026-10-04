import { exclusiveJob } from './lock.js';
import { serial } from '../../shared/transactions.js';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RetentionService } from "../../modules/retention/service.js";
import { DatabaseService } from '../database.service.js';
import { MediaService } from "../../modules/media/service.js";
import { TransactionsService } from "../../modules/transactions/service.js";

@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(private readonly db: DatabaseService, private readonly media: MediaService, private readonly transactions: TransactionsService, private readonly retention: RetentionService) {}

  async purgeClosedAccounts(): Promise<void> { await this.retention.accounts(); await this.retention.drain(); }

  async run(): Promise<void> { await exclusiveJob('maintenance', () => this.runUnlocked()); }
  private async runUnlocked(): Promise<void> {
    await this.transactions.reminders();
    await this.media.cleanupOrphans();
    await this.retention.purge();
    await this.db.verificationToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } });
    await serial(this.db, async (tx) => {
      const rows = await tx.mailOutbox.findMany({ where: { sentAt: { not: null }, expiresAt: { lt: new Date() }, createdAt: { lt: new Date(Date.now() - 86400000) } }, select: { id: true } });
      for (const row of rows) await tx.storageDeletion.upsert({ where: { storageKey: row.id + '.txt' }, update: {}, create: { storageKey: row.id + '.txt', kind: 'MAIL' } });
      await tx.mailOutbox.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    });
    await this.db.authRateBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
    await this.retention.drain();
  }

  onModuleInit(): void {
    void this.run().catch((error: unknown) => console.error(JSON.stringify({ event: 'maintenance_failed', type: error instanceof Error ? error.name : 'Unknown' })));
    this.timer = setInterval(() => void this.run().catch((error: unknown) => console.error(JSON.stringify({ event: 'maintenance_failed', type: error instanceof Error ? error.name : 'Unknown' }))), 60 * 60 * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }
}
