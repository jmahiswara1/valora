import { ApiTags } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Query, Param, Req, Post, Body, Headers } from '@nestjs/common';
import { SessionGuard, AdminGuard } from '../auth/guards.js';
import { PassportImpactService } from '../history/projection.service.js';
import { type AppRequest, AppException, ZodPipe } from '../../shared/http.js';
import { rubricDraftSchema, rubricDraftUpdateSchema, versionReasonSchema, categoryAdminSchema, economicReferenceCreateSchema } from '@valora/contracts';
import { z } from 'zod';
import { AdminStage5Service } from "./service.js";

@ApiTags('admin-stage5') @Controller('admin') @UseGuards(SessionGuard, AdminGuard)
export class AdminStage5Controller {
  constructor(private readonly service: AdminStage5Service, private readonly impact: PassportImpactService) {}
  @Get('dashboard') overview() { return this.service.overview(); }
  @Get('users') users(@Query('q') q?: string, @Query('status') status?: string, @Query('cursor') after?: string) { return this.service.users(q, status, after); }
  @Get('users/:id') user(@Param('id') id: string) { return this.service.user(id); }
  @Get('transactions') transactions(@Query('q') q?: string, @Query('status') status?: string, @Query('cursor') after?: string) { return this.service.transactions(q, status, after); }
  @Get('transactions/:id') transaction(@Req() r: AppRequest, @Param('id') id: string) { return this.service.transaction(r.actor!.id, id); }
  @Get('impact') aggregate(@Query('from') from?: string, @Query('to') to?: string) { return this.impact.impact(undefined, from, to); }
  @Get('analytics') analytics(@Query('from') from?: string, @Query('to') to?: string) { return this.service.analytics(from, to); }
  @Get('audit') audit(@Query('cursor') after?: string, @Query('targetType') target?: string) { return this.service.auditList(after, target); }
  @Get('audit/:id') detail(@Req() r: AppRequest, @Param('id') id: string, @Query('scopeType') type: string, @Query('scopeId') scopeId: string) { if (!['REPORT', 'CORRECTION', 'DISPUTE'].includes(type)) throw new AppException(400, 'INVALID_INPUT', 'Lingkup kasus tidak valid.'); return this.service.auditDetail(r.actor!.id, id, type as 'REPORT', scopeId); }
  @Get('rubrics') rubrics() { return this.service.rubrics(); }
  @Post('rubrics/drafts') draft(@Req() r: AppRequest, @Body(new ZodPipe(rubricDraftSchema)) input: z.infer<typeof rubricDraftSchema>, @Headers('idempotency-key') key?: string) { return this.service.draft(r.actor!.id, input, key); }
  @Post('rubrics/drafts/:id') edit(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(rubricDraftUpdateSchema)) input: z.infer<typeof rubricDraftUpdateSchema>, @Headers('idempotency-key') key?: string) { return this.service.editDraft(r.actor!.id, id, input, key); }
  @Get('rubrics/drafts/:id/tests') fixtures(@Param('id') id: string) { return this.service.fixtures(id); }
  @Post('rubrics/drafts/:id/publish') publish(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(versionReasonSchema)) input: z.infer<typeof versionReasonSchema>, @Headers('idempotency-key') key?: string) { return this.service.publish(r.actor!.id, id, input, key); }
  @Post('categories/:code') category(@Req() r: AppRequest, @Param('code') code: string, @Body(new ZodPipe(categoryAdminSchema)) input: z.infer<typeof categoryAdminSchema>, @Headers('idempotency-key') key?: string) { return this.service.category(r.actor!.id, code, input, key); }
  @Post('economic-references/:id/deactivate') deactivateReference(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(versionReasonSchema)) input: z.infer<typeof versionReasonSchema>, @Headers('idempotency-key') key?: string) { return this.service.referenceStatus(r.actor!.id, id, false, input, key); }
  @Post('economic-references/:id/activate') activateReference(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(versionReasonSchema)) input: z.infer<typeof versionReasonSchema>, @Headers('idempotency-key') key?: string) { return this.service.referenceStatus(r.actor!.id, id, true, input, key); }
  @Post('economic-references') reference(@Req() r: AppRequest, @Body(new ZodPipe(economicReferenceCreateSchema)) input: z.infer<typeof economicReferenceCreateSchema>, @Headers('idempotency-key') key?: string) { return this.service.reference(r.actor!.id, input, key); }
}
