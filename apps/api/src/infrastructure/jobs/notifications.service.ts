import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { exclusiveJob } from './lock.js';
import { NotificationService } from '../../modules/notifications/service.js';

@Injectable()
export class NotificationJobs implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private readonly notifications: NotificationService) {}
  async run() { await exclusiveJob('offer-expiration', () => this.notifications.expire()); }
  onModuleInit() {
    const run = () => void this.run().catch((error: unknown) => console.error(JSON.stringify({ event: 'notification_job_failed', type: error instanceof Error ? error.name : 'Unknown' })));
    run(); this.timer = setInterval(run, 60000); this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
}
