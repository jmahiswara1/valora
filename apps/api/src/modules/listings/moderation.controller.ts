import { createHash } from 'node:crypto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Param, Post, Req, Body, Headers } from '@nestjs/common';
import { SessionGuard, AdminGuard } from '../auth/guards.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { type ModerationQueueDto, type ModerationDetailDto, moderationDecisionSchema, type ModerationDecisionInput, uuidSchema } from '@valora/contracts';
import { AppException, type AppRequest, ZodPipe } from '../../shared/http.js';
import { serial, lockRows } from '../../shared/transactions.js';
import { event } from '../history/ledger.js';
import { revisionInclude, revisionDto, safetyFlags, recommendations } from './shared.js';

const sha = (input: unknown) => createHash('sha256').update(JSON.stringify(input)).digest('hex');

@ApiTags('market-moderation')
@Controller('admin/listing-reviews')
@UseGuards(SessionGuard, AdminGuard)
export class ListingModerationController {
  constructor(private readonly db: DatabaseService) {}
  @Get()
  @ApiOperation({ summary: 'Antrean review Listing biasa dan khusus' })
  async queue(): Promise<{ data: ModerationQueueDto[] }> {
    const rows = await this.db.listing.findMany({ where: { status: 'PENDING_REVIEW', currentRevisionId: { not: null } }, include: { owner: true, currentRevision: { include: { city: true } } }, orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }], take: 100 });
    const data = rows.flatMap((row) => row.currentRevision ? [{ revisionId: row.currentRevision.id, listingId: row.id, listingType: row.type, title: row.currentRevision.title, ownerName: row.owner.displayName, cityName: row.currentRevision.city.name, specialReview: row.currentRevision.riskFlags.some((flag) => flag.startsWith('SPECIAL_REVIEW:')), riskFlags: row.currentRevision.riskFlags, submittedAt: row.updatedAt.toISOString(), revisionNo: row.currentRevision.revisionNo, version: row.version }] : []);
    data.sort((a, b) => Number(b.specialReview) - Number(a.specialReview) || a.submittedAt.localeCompare(b.submittedAt));
    return { data };
  }

  @Get(':revisionId')
  @ApiOperation({ summary: 'Detail snapshot Listing untuk review admin' })
  async detail(@Param('revisionId') revisionId: string): Promise<ModerationDetailDto> {
    const revision = await this.db.listingRevision.findUnique({ where: { id: revisionId }, include: { ...revisionInclude, listing: { include: { owner: true } } } });
    if (!revision || revision.listing.status !== 'PENDING_REVIEW' || revision.listing.currentRevisionId !== revision.id) throw new AppException(404, 'NOT_FOUND', 'Pengajuan Listing tidak ditemukan.');
    return { revisionId: revision.id, listingId: revision.listingId, listingVersion: revision.listing.version, listingType: revision.listing.type, ownerName: revision.listing.owner.displayName, cityName: revision.city.name, specialReview: revision.riskFlags.some((flag) => flag.startsWith('SPECIAL_REVIEW:')), riskFlags: revision.riskFlags, submittedAt: revision.listing.updatedAt.toISOString(), revision: revisionDto(revision, revision.listingId) };
  }

  @Post(':revisionId/decide')
  @ApiOperation({ summary: 'Putuskan review revisi Listing dengan alasan dan audit' })
  async decide(@Req() request: AppRequest, @Param('revisionId') revisionId: string, @Body(new ZodPipe(moderationDecisionSchema)) input: ModerationDecisionInput, @Headers('idempotency-key') idempotencyKey?: string) {
    const userId = request.actor!.id;
    if (!uuidSchema.safeParse(idempotencyKey).success) throw new AppException(400, 'INVALID_INPUT', 'Idempotency-Key UUID wajib diisi.');
    const requestHash = sha(input);
    return serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [userId]);
      const revision = await tx.listingRevision.findUnique({ where: { id: revisionId }, include: { listing: { include: { item: true } }, assessment: true, media: { include: { media: true } }, city: true } });
      if (!revision) throw new AppException(404, 'NOT_FOUND', 'Revisi Listing tidak ditemukan.');
      await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${revision.itemId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${revision.listingId}::uuid FOR UPDATE`;
      const prior = await tx.moderationReview.findUnique({ where: { reviewerId_idempotencyKey: { reviewerId: userId, idempotencyKey: idempotencyKey! } } });
      if (prior) {
        if (prior.listingRevisionId !== revisionId || prior.requestHash !== requestHash) throw new AppException(409, 'IDEMPOTENCY_CONFLICT', 'Kunci sudah dipakai untuk keputusan lain.');
        const currentListing = await tx.listing.findUnique({ where: { id: revision.listingId }, select: { status: true } });
        return { reviewId: prior.id, decision: prior.decision, listingStatus: currentListing?.status ?? 'REJECTED' };
      }
      const listing = await tx.listing.findUniqueOrThrow({ where: { id: revision.listingId }, include: { item: true } });
      if (listing.version !== input.expectedVersion || listing.status !== 'PENDING_REVIEW' || listing.currentRevisionId !== revisionId || revision.itemRevision !== listing.item.itemRevision || listing.item.currentOwnerId !== listing.ownerId) throw new AppException(409, 'STATE_CONFLICT', 'Revisi tidak lagi menjadi pengajuan terkini.');
      if (input.decision === 'APPROVE') {
        if (await tx.listing.findFirst({ where: { itemId: listing.itemId, id: { not: listing.id }, status: { in: ['ACTIVE', 'RESERVED'] } }, select: { id: true } })) throw new AppException(409, 'STATE_CONFLICT', 'Item ini sudah memiliki Listing aktif.');
        const flags = safetyFlags(revision.assessment);
        const action = listing.type === 'RESELL' ? 'RESELL' : listing.type;
        const rubricKey = `${revision.categoryCode}${revision.subcategoryCode ? `/${revision.subcategoryCode}` : ''}`;
        const rubric = await tx.rubricVersion.findFirst({ where: { rubricKey, effectiveAt: { lte: new Date() } }, orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }] });
        const latestAssessment = rubric ? await tx.assessment.findFirst({ where: { valid: true, itemId: listing.itemId, createdById: listing.ownerId, itemRevision: listing.item.itemRevision, rubricVersionId: rubric.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } }) : null;
        const photoCount = revision.media.filter((entry) => !entry.media.deletedAt && entry.media.repairRecordId === null && entry.media.itemId === listing.itemId).length;
        const eligible = recommendations(revision.assessment).some((entry) => entry.action === action && entry.status === 'ELIGIBLE');
        const category = await tx.category.findUnique({ where: { code: revision.categoryCode } });
        const subcategory = revision.subcategoryCode ? await tx.category.findUnique({ where: { code: revision.subcategoryCode } }) : null;
        const blocked = !category?.active || (revision.subcategoryCode && !subcategory?.active) || !revision.assessment.valid || !rubric || rubric.id !== revision.rubricVersionId || latestAssessment?.id !== revision.assessmentId || !revision.city.active || revision.assessment.status === 'INCOMPLETE' || (listing.type === 'RESELL' && revision.assessment.status !== 'COMPLETE') || flags.some((flag) => flag.startsWith('PROHIBITED:')) || !eligible || photoCount < 1;
        if (blocked) throw new AppException(422, 'ACTION_INELIGIBLE', 'Revisi tidak lolos gerbang kategori atau penilaian.');
      }
      const before = { status: listing.status, revisionId };
      const status = input.decision === 'APPROVE' ? 'ACTIVE' : 'REJECTED';
      const review = await tx.moderationReview.create({ data: { listingRevisionId: revisionId, reviewerId: userId, decision: input.decision, reasonCode: input.reasonCode, reasonText: input.reasonText, riskFlags: input.riskFlags, rubricVersionId: revision.rubricVersionId, policyVersion: revision.policyVersion, idempotencyKey: idempotencyKey!, requestHash } });
      if (status === 'ACTIVE') await event(tx, revision.itemId, 'LISTED', 'LISTING_REVISION', revision.id, review.createdAt, { type: listing.type }, '', 'SYSTEM_RECORDED');
      await tx.listing.update({ where: { id: listing.id }, data: { status, publishedAt: status === 'ACTIVE' ? new Date() : null, version: { increment: 1 } } });
      await tx.adminAction.create({ data: { adminId: userId, targetType: 'LISTING', targetId: listing.id, action: `REVIEW_${input.decision}`, reason: input.reasonText, beforeState: before, afterState: { status, revisionId, reasonCode: input.reasonCode } } });
      return { reviewId: review.id, decision: review.decision, listingStatus: status };
    });
  }
}
