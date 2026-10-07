import { DatabaseService } from '../database.service.js';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HandoverService } from '../../modules/handover/service.js';
import { TransactionsService } from '../../modules/transactions/service.js';
import { exclusiveJob } from './lock.js';

@Injectable()
export class HandoverJobs implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private readonly handover: HandoverService, private readonly transactions: TransactionsService, private readonly db: DatabaseService) {}
  async run() { return exclusiveJob('handover-coordination', async () => {
    const run = await this.db.maintenanceRun.create({ data: { job: 'HANDOVER_COORDINATION' } });
    try { const result = await this.handover.jobs(); await this.transactions.reminders(); await this.db.maintenanceRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', completedAt: new Date(), counts: result } }); return result; }
    catch (error) { await this.db.maintenanceRun.update({ where: { id: run.id }, data: { status: 'FAILED', completedAt: new Date(), error: error instanceof Error ? error.name : 'Unknown' } }); throw error; }
  }); }
  onModuleInit() {
    const run = () => void this.run().catch((error: unknown) => console.error(JSON.stringify({ event: 'handover_job_failed', type: error instanceof Error ? error.name : 'Unknown' })));
    run(); this.timer = setInterval(run, 60000); this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
}
