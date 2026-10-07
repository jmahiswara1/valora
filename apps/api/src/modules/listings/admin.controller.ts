import { expireOffers } from '../notifications/events.js';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Post, Req, Param, Body, Headers } from '@nestjs/common';
import { SessionGuard, AdminGuard } from '../auth/guards.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { OperationsService } from "../operations/service.js";
import { type AppRequest, ZodPipe, AppException } from '../../shared/http.js';
import { listingAdminActionSchema, type ListingAdminActionInput, listingAdminReleaseSchema, type ListingAdminReleaseInput } from '@valora/contracts';
import { idempotent, lockRows } from '../../shared/transactions.js';

@ApiTags('market-moderation')
@Controller('admin/listings')
@UseGuards(SessionGuard, AdminGuard)
export class ListingAdminController {
  constructor(private readonly db: DatabaseService, private readonly operations: OperationsService) {}
  @Post(':id/suspend')
  @ApiOperation({ summary: 'Tangguhkan Listing terkait laporan' })
  async suspend(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(listingAdminActionSchema)) input: ListingAdminActionInput, @Headers('idempotency-key') key?: string) {
    return idempotent(this.db, request.actor!.id, 'admin-listing:' + id + ':' + (('withdraw' in input) ? 'release' : 'suspend'), key, input, async (tx) => {
      await lockRows(tx, 'User', [request.actor!.id]);
      await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${id}::uuid FOR UPDATE`;
      await this.operations.requireGrant(tx, request.actor!.id, 'REPORT', input.reportId);
      const listing = await tx.listing.findUnique({ where: { id } });
      const report = await tx.report.findUnique({ where: { id: input.reportId } });
      if (!listing || !report || report.targetType !== 'LISTING' || report.targetId !== id || !['OPEN', 'IN_REVIEW'].includes(report.status)) throw new AppException(404, 'NOT_FOUND', 'Laporan tidak ditemukan.');
      if (listing.version !== input.expectedVersion || listing.status !== 'ACTIVE') throw new AppException(409, 'STATE_CONFLICT', 'Listing tidak dapat ditangguhkan saat ini.');
      await tx.listing.update({ where: { id }, data: { status: 'SUSPENDED', publishedAt: null, version: { increment: 1 } } });
      await expireOffers(tx, { listingId: id, status: { in: ['PENDING', 'COUNTERED'] } }, 'LISTING_SUSPENDED');
      await tx.adminAction.create({ data: { adminId: request.actor!.id, reportId: report.id, targetType: 'LISTING', targetId: id, action: 'LISTING_SUSPENDED', reason: input.reason, beforeState: { status: listing.status }, afterState: { status: 'SUSPENDED' } } });
      await tx.report.update({ where: { id: report.id }, data: { status: 'IN_REVIEW', version: { increment: 1 }, assignedAdminId: request.actor!.id } });
      return { id, status: 'SUSPENDED' as const };
    });
  }
  @Post(':id/release')
  @ApiOperation({ summary: 'Kirim Listing suspended ke review ulang atau tarik permanen' })
  async release(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(listingAdminReleaseSchema)) input: ListingAdminReleaseInput, @Headers('idempotency-key') key?: string) {
    return idempotent(this.db, request.actor!.id, 'admin-listing:' + id + ':' + (('withdraw' in input) ? 'release' : 'suspend'), key, input, async (tx) => {
      await lockRows(tx, 'User', [request.actor!.id]);
      await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${id}::uuid FOR UPDATE`;
      await this.operations.requireGrant(tx, request.actor!.id, 'REPORT', input.reportId);
      const listing = await tx.listing.findUnique({ where: { id } });
      const report = await tx.report.findUnique({ where: { id: input.reportId } });
      if (!listing || !report || report.targetType !== 'LISTING' || report.targetId !== id || !['OPEN', 'IN_REVIEW'].includes(report.status)) throw new AppException(404, 'NOT_FOUND', 'Laporan tidak ditemukan.');
      if (listing.version !== input.expectedVersion || listing.status !== 'SUSPENDED') throw new AppException(409, 'STATE_CONFLICT', 'Listing tidak dapat dilepas saat ini.');
      const status = input.withdraw ? 'WITHDRAWN' : 'PENDING_REVIEW';
      await tx.listing.update({ where: { id }, data: { status, publishedAt: null, version: { increment: 1 } } });
      await tx.adminAction.create({ data: { adminId: request.actor!.id, reportId: report.id, targetType: 'LISTING', targetId: id, action: input.withdraw ? 'LISTING_WITHDRAWN' : 'LISTING_RELEASED_TO_REVIEW', reason: input.reason, beforeState: { status: listing.status }, afterState: { status } } });
      await tx.report.update({ where: { id: report.id }, data: { status: 'RESOLVED', version: { increment: 1 }, resolvedAt: new Date(), assignedAdminId: request.actor!.id } });
      return { id, status };
    });
  }
}
