import { ApiTags } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Query, Param, Post, Req, Body, Headers } from '@nestjs/common';
import { SessionGuard, AdminGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { versionReasonSchema, accessReasonSchema, ownershipCorrectionSchema, impactCorrectionSchema, sourceCorrectionSchema, passportRestrictionSchema } from '@valora/contracts';
import { z } from 'zod';
import { OperationsService } from "./service.js";

@ApiTags('admin-operations') @Controller('admin') @UseGuards(SessionGuard, AdminGuard)
export class OperationsController {
  constructor(private readonly service: OperationsService) {}
  @Get('correction-cases') list(@Query('cursor') cursor?: string) { return this.service.caseList(cursor); }
  @Get('correction-cases/:id/metadata') metadata(@Param('id') id: string) { return this.service.caseMetadata(id); }
  @Post('correction-cases/:id/close') close(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(versionReasonSchema)) input: z.infer<typeof versionReasonSchema>, @Headers('idempotency-key') key?: string) { return this.service.close(r.actor!.id, id, input, key); }
  @Post('correction-cases/:id/claim') claim(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(versionReasonSchema)) input: z.infer<typeof versionReasonSchema>, @Headers('idempotency-key') key?: string) { return this.service.claim(r.actor!.id, id, input, key); }
  @Post('correction-cases/:id/access') grant(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(accessReasonSchema)) input: { reason: string }, @Headers('idempotency-key') key?: string) { return this.service.grant(r.actor!.id, 'CORRECTION', id, input.reason, key); }
  @Post('transactions/:id/correct') reverse(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(ownershipCorrectionSchema)) input: z.infer<typeof ownershipCorrectionSchema>, @Headers('idempotency-key') key?: string) { return this.service.reverse(r.actor!.id, id, input, key); }
  @Post('impact/corrections') impact(@Req() r: AppRequest, @Body(new ZodPipe(impactCorrectionSchema)) input: z.infer<typeof impactCorrectionSchema>, @Headers('idempotency-key') key?: string) { return this.service.adjustImpact(r.actor!.id, input, key); }
  @Post('assessments/:id/validity') assessment(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(sourceCorrectionSchema)) input: z.infer<typeof sourceCorrectionSchema>, @Headers('idempotency-key') key?: string) { return this.service.source(r.actor!.id, 'ASSESSMENT', id, input, key); }
  @Post('repairs/:id/validity') repair(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(sourceCorrectionSchema)) input: z.infer<typeof sourceCorrectionSchema>, @Headers('idempotency-key') key?: string) { return this.service.source(r.actor!.id, 'REPAIR', id, input, key); }
  @Post('passport/:id/visibility') visibility(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(passportRestrictionSchema)) input: z.infer<typeof passportRestrictionSchema>, @Headers('idempotency-key') key?: string) { return this.service.visibility(r.actor!.id, id, input, key); }
  @Post('users/:id/suspend') suspend(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(versionReasonSchema)) input: z.infer<typeof versionReasonSchema>, @Headers('idempotency-key') key?: string) { return this.service.userStatus(r.actor!.id, id, input, true, key); }
  @Post('users/:id/release') release(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(versionReasonSchema)) input: z.infer<typeof versionReasonSchema>, @Headers('idempotency-key') key?: string) { return this.service.userStatus(r.actor!.id, id, input, false, key); }
}
