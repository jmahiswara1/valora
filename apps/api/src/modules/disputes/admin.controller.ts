import { HandoverService } from '../handover/service.js';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Post, Req, Param, Headers, Body, Get, Query } from '@nestjs/common';
import { SessionGuard, AdminGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { adminHandoverPageSchema, cancellationSchema, listPageSchema, caseClaimSchema, caseAccessSchema, resolveDisputeSchema, type ResolveDisputeInput } from '@valora/contracts';
import { DisputesService } from "./service.js";

@ApiTags('admin-cases') @Controller('admin') @UseGuards(SessionGuard, AdminGuard)
export class DisputesAdminController {
  constructor(private readonly cases: DisputesService, private readonly handover: HandoverService) {}
  @Post('transactions/:id/open-case') @ApiOperation({ summary: 'Buka kasus tindak lanjut untuk transaksi terlambat' })
  overdue(@Req() req: AppRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(cancellationSchema)) input: { expectedVersion: number; reason: string }) { return this.cases.overdueCase(req.actor!.id, id, input, key); }
  @Get('disputes') @ApiOperation({ summary: 'Antrean sengketa dan transaksi terlambat tanpa bukti privat' })
  queue(@Query(new ZodPipe(listPageSchema)) query: { cursor?: string; limit: number; status?: string }) { return this.cases.queue(query); }
  @Get('disputes/:id') @ApiOperation({ summary: 'Metadata kasus dan konteks bagi admin yang ditugaskan' })
  detail(@Req() req: AppRequest, @Param('id') id: string) { return this.cases.adminDetail(req.actor!.id, id); }
  @Post('disputes/:id/claim') @ApiOperation({ summary: 'Ambil penugasan kasus secara atomik' })
  claim(@Req() req: AppRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(caseClaimSchema)) input: { expectedVersion: number }) { return this.cases.claim(req.actor!.id, id, input.expectedVersion, key); }
  @Post('cases/:id/handover-access')
  handoverAccess(@Req() req: AppRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(caseAccessSchema)) input: { reason: string }) { return this.cases.grant(req.actor!.id, id, 'HANDOVER', input.reason, key); }
  @Get('cases/:id/handover')
  handoverDetail(@Req() req: AppRequest, @Param('id') id: string, @Query(new ZodPipe(adminHandoverPageSchema)) query: { limit: number; cursor?: string; shipmentCursor?: string }) { return this.handover.admin(req.actor!.id, id, query); }
  @Post('cases/:id/chat-access') @ApiOperation({ summary: 'Akses chat kasus dengan alasan dan audit, berlaku lima menit' })
  chat(@Req() req: AppRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(caseAccessSchema)) input: { reason: string }) { return this.cases.grant(req.actor!.id, id, 'CHAT', input.reason, key); }
  @Post('cases/:id/evidence-access') @ApiOperation({ summary: 'Akses bukti kasus dengan alasan dan audit, berlaku lima menit' })
  evidenceAccess(@Req() req: AppRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(caseAccessSchema)) input: { reason: string }) { return this.cases.grant(req.actor!.id, id, 'EVIDENCE', input.reason, key); }
  @Get('cases/:id/evidence') @ApiOperation({ summary: 'Baca bukti dengan penugasan dan akses aktif' })
  evidence(@Req() req: AppRequest, @Param('id') id: string) { return this.cases.adminEvidence(req.actor!.id, id); }
  @Get('cases/:id/messages') @ApiOperation({ summary: 'Baca histori chat kasus dengan akses aktif' })
  messages(@Req() req: AppRequest, @Param('id') id: string, @Query('before') before?: string) { return this.cases.adminMessages(req.actor!.id, id, before); }
  @Post('transactions/:id/resolve-dispute') @ApiOperation({ summary: 'Putusan admin: lanjut, batal, atau transfer terotorisasi' })
  resolve(@Req() req: AppRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(resolveDisputeSchema)) input: ResolveDisputeInput) { return this.cases.resolve(req.actor!.id, id, input, key); }
}
