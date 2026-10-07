import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SearchesService } from '../../modules/searches/service.js';
import { exclusiveJob } from './lock.js';

@Injectable()
export class SearchJobs implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private readonly searches: SearchesService) {}
  async run() { await exclusiveJob('saved-search-alerts', async () => { for (let i = 0; i < 10; i++) if (!await this.searches.processBatch()) break; }); }
  onModuleInit() {
    const run = () => void this.run().catch((error: unknown) => console.error(JSON.stringify({ event: 'saved_search_job_failed', type: error instanceof Error ? error.name : 'Unknown' })));
    run(); this.timer = setInterval(run, 60000); this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
}
