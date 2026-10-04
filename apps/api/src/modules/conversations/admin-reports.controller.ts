import { ApiTags } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Query, Param, Post, Req, Body, Headers } from '@nestjs/common';
import { SessionGuard, AdminGuard } from '../auth/guards.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { OperationsService } from "../operations/service.js";
import { cursorId, page } from '../../shared/pagination.js';
import { AppException, type AppRequest, ZodPipe } from '../../shared/http.js';
import { versionReasonSchema, accessReasonSchema, reportReviewSchema, uuidSchema } from '@valora/contracts';
import { idempotent, lockRows, serial } from '../../shared/transactions.js';
import { audit } from '../operations/helpers.js';

@ApiTags('reports-blocks')
@Controller('admin/reports')
@UseGuards(SessionGuard, AdminGuard)
export class AdminReportsController {
  constructor(private readonly db: DatabaseService, private readonly operations: OperationsService) {}
  @Get()
  async list(@Query('cursor') cursor?: string) {
    const rows = await this.db.report.findMany({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], ...cursorId(cursor), take: 31 });
    return page(rows.map((row) => ({ id: row.id, targetType: row.targetType, targetId: row.targetId, reasonCode: row.reasonCode, status: row.status, assignedAdminId: row.assignedAdminId, version: row.version, createdAt: row.createdAt.toISOString() })));
  }
  @Get(':id/metadata')
  async metadata(@Param('id') id: string) {
    const row = await this.db.report.findUnique({ where: { id } });
    if (!row) throw new AppException(404, 'NOT_FOUND', 'Laporan tidak ditemukan.');
    return { id: row.id, targetType: row.targetType, targetId: row.targetId, reasonCode: row.reasonCode, status: row.status, assignedAdminId: row.assignedAdminId, version: row.version, createdAt: row.createdAt.toISOString() };
  }
  @Post(':id/claim')
  claim(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(versionReasonSchema)) input: { expectedVersion: number; reason: string }, @Headers('idempotency-key') key?: string) {
    return idempotent(this.db, req.actor!.id, 'report-claim:' + id, key, input, async (tx) => {
      await lockRows(tx, 'Report', [id]); const row = await tx.report.findUnique({ where: { id } });
      if (!row || row.version !== input.expectedVersion || !['OPEN', 'IN_REVIEW'].includes(row.status) || (row.assignedAdminId && row.assignedAdminId !== req.actor!.id)) throw new AppException(409, 'STATE_CONFLICT', 'Penugasan laporan sudah berubah.');
      const updated = await tx.report.update({ where: { id }, data: { status: 'IN_REVIEW', assignedAdminId: req.actor!.id, version: { increment: 1 } } });
      await audit(tx, req.actor!.id, 'REPORT', id, 'CLAIM_REPORT', input.reason, undefined, undefined, id);
      return { id, status: updated.status, version: updated.version };
    });
  }
  @Post(':id/access')
  access(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(accessReasonSchema)) input: { reason: string }, @Headers('idempotency-key') key?: string) { return this.operations.grant(req.actor!.id, 'REPORT', id, input.reason, key); }
  @Get(':id')
  async detail(@Req() req: AppRequest, @Param('id') id: string) {
    validReportId(id);
    return serial(this.db, async (tx) => {
      await this.operations.requireGrant(tx, req.actor!.id, 'REPORT', id);
      const row = await tx.report.findUniqueOrThrow({ where: { id } });
      const listing = row.targetType === 'LISTING' ? await tx.listing.findUnique({ where: { id: row.targetId }, include: { item: true } }) : null;
      const message = row.messageId ? await tx.message.findUnique({ where: { id: row.messageId } }) : null;
      return { id, listing: listing ? { id: listing.id, status: listing.status, version: listing.version, itemId: listing.itemId, passportVersion: listing.item.passportVersion, passportVisibility: listing.item.passportVisibility } : null, targetType: row.targetType, targetId: row.targetId, details: row.details, reasonCode: row.reasonCode, status: row.status, version: row.version, message: message && !message.deletedAt ? { body: message.body, sentAt: message.sentAt.toISOString() } : null };
    });
  }
  @Post(':id/resolve')
  resolve(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(reportReviewSchema)) input: { expectedVersion: number; decision: 'RESOLVED' | 'DISMISSED'; reason: string }, @Headers('idempotency-key') key?: string) {
    return idempotent(this.db, req.actor!.id, 'report-resolve:' + id, key, input, async (tx) => {
      await lockRows(tx, 'Report', [id]); await this.operations.requireGrant(tx, req.actor!.id, 'REPORT', id);
      const row = await tx.report.findUniqueOrThrow({ where: { id } });
      if (row.version !== input.expectedVersion || !['OPEN', 'IN_REVIEW'].includes(row.status)) throw new AppException(409, 'STATE_CONFLICT', 'Laporan sudah berubah.');
      await tx.report.update({ where: { id }, data: { status: input.decision, resolvedAt: new Date(), version: { increment: 1 } } });
      await audit(tx, req.actor!.id, 'REPORT', id, 'REPORT_' + input.decision, input.reason, { status: row.status }, { status: input.decision }, id);
      return { id, status: input.decision, version: row.version + 1 };
    });
  }
}

function validReportId(id: string) { if (!uuidSchema.safeParse(id).success) throw new AppException(404, 'NOT_FOUND', 'Laporan tidak ditemukan.'); }
