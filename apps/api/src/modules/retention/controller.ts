import { ApiTags } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Query, Post, Req, Body, Headers, Param } from '@nestjs/common';
import { SessionGuard, AdminGuard } from '../auth/guards.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { retentionHoldSchema, versionReasonSchema } from '@valora/contracts';
import { z } from 'zod';
import { RetentionService } from "./service.js";

@ApiTags('retention') @Controller('admin/retention') @UseGuards(SessionGuard, AdminGuard)
export class RetentionController {
  constructor(private readonly service: RetentionService, private readonly db: DatabaseService) {}
  @Get('holds') holds(@Query('cursor') cursor?: string) { return this.service.holds(cursor); }
  @Post('holds') hold(@Req() r: AppRequest, @Body(new ZodPipe(retentionHoldSchema)) input: z.infer<typeof retentionHoldSchema>, @Headers('idempotency-key') key?: string) { return this.service.hold(r.actor!.id, input, key); }
  @Post('holds/:id/release') release(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(versionReasonSchema)) input: z.infer<typeof versionReasonSchema>, @Headers('idempotency-key') key?: string) { return this.service.release(r.actor!.id, id, input, key); }
  @Get('runs') runs() { return this.db.maintenanceRun.findMany({ orderBy: { startedAt: 'desc' }, take: 50 }); }
}
