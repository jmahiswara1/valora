import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { StorageService } from '../../infrastructure/storage.service.js';
import type { PassportDto, PassportTimelineEntry, ImpactDto, TransactionSnapshot } from '@valora/contracts';
import { validId, serial } from '../../shared/transactions.js';
import { AppException } from '../../shared/http.js';
import type { Response } from 'express';
import { impactMetrics } from './ledger.js';
import { period } from './helpers.js';

const labels: Record<string, string> = { REGISTERED: 'Didaftarkan di Valora', ASSESSMENT_CREATED: 'Penilaian dilaporkan pemilik', REPAIR_RECORDED: 'Perbaikan dilaporkan pemilik', LISTED: 'Listing dipublikasikan', TRANSFERRED_BY_SALE: 'Berpindah melalui Resell', TRANSFERRED_BY_EXCHANGE: 'Berpindah melalui Exchange', TRANSFERRED_BY_DONATION: 'Berpindah melalui Donate', CORRECTION: 'Riwayat dikoreksi' };

@Injectable()
export class PassportImpactService {
  constructor(private readonly db: DatabaseService, private readonly storage: StorageService) {}
  async passport(id: string, ownerId?: string): Promise<PassportDto> {
    validId(id);
    // A single repeatable read makes visibility and its projection consistent.
    return serial(this.db, async (tx) => {
      const item = await tx.item.findUnique({ where: { id } });
      if (!item || (ownerId && (item.currentOwnerId !== ownerId || item.archivedAt))) throw new AppException(404, 'NOT_FOUND', 'Passport tidak ditemukan.');
      const completed = await tx.transaction.findFirst({ where: { status: 'COMPLETED', OR: [{ itemId: id }, { offeredItemId: id }] } });
      const visibleListing = await tx.listing.findFirst({ where: { itemId: id, status: { in: ['ACTIVE', 'RESERVED'] } } });
      if (!ownerId && ((!completed && !visibleListing) || item.passportVisibility === 'HIDDEN')) throw new AppException(404, 'NOT_FOUND', 'Passport tidak ditemukan.');
      const result: PassportDto = { itemId: id, categoryCode: item.categoryCode, visibility: item.passportVisibility, version: item.passportVersion, projection: ownerId ? 'OWNER' : 'PUBLIC', title: null, description: null, media: [], timeline: [] };
      if (!ownerId && item.passportVisibility === 'LIMITED') return result;
      const published = await tx.listingRevision.findFirst({ where: { itemId: id, reviews: { some: { decision: 'APPROVE' } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { media: { include: { media: true }, orderBy: { orderIndex: 'asc' } } } });
      // No transaction exchange snapshot is copied into the public projection.
      result.categoryCode = published?.categoryCode ?? item.categoryCode;
      result.title = ownerId ? item.title : published?.title ?? null;
      result.description = ownerId ? item.description : published?.description ?? null;
      result.media = published?.media.filter((ref) => !ref.media.deletedAt && !ref.media.caseId && !ref.media.repairRecordId).map((ref) => ({ id: ref.mediaId, url: '/api/v1/passport/' + id + '/media/' + ref.mediaId })) ?? [];
      const rows = await tx.passportEvent.findMany({ where: { itemId: id }, orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }] });
      for (const row of rows) {
        const entry: PassportTimelineEntry = { id: row.id, type: row.eventType, origin: row.origin, occurredAt: row.occurredAt.toISOString(), recordedAt: row.recordedAt.toISOString(), correctionOfId: row.correctionOfId, summary: labels[row.eventType] ?? 'Riwayat Item' };
        if (row.sourceType === 'ASSESSMENT' && row.eventType === 'ASSESSMENT_CREATED') {
          const assessment = await tx.assessment.findUnique({ where: { id: row.sourceId }, include: { rubricVersion: true } });
          if (!assessment) continue;
          // Only assessments explicitly published in an approved listing are public.
          if (!ownerId && !await tx.listingRevision.findFirst({ where: { assessmentId: assessment.id, reviews: { some: { decision: 'APPROVE' } } } })) continue;
          const active = await tx.rubricVersion.findFirst({ where: { rubricKey: assessment.rubricVersion.rubricKey, effectiveAt: { lte: new Date() } }, orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }] });
          entry.assessment = { status: assessment.status, score: assessment.valid ? assessment.score : null, label: assessment.valid ? assessment.label : null, ruleVersion: assessment.rubricVersion.ruleVersion, historical: !assessment.valid || assessment.createdById !== item.currentOwnerId || assessment.itemRevision !== item.itemRevision || active?.id !== assessment.rubricVersionId, valid: assessment.valid };
        }
        if (row.sourceType === 'REPAIR' && row.eventType === 'REPAIR_RECORDED') {
          const repair = await tx.repairRecord.findUnique({ where: { id: row.sourceId } });
          if (!repair || (!ownerId && (!repair.shareSummaryPublic || repair.status !== 'VALID'))) continue;
          entry.repair = { summary: repair.actionSummary, afterCondition: repair.afterCondition, status: repair.status, outcome: repair.outcome };
        }
        if (row.eventType.startsWith('TRANSFERRED')) entry.summary += row.origin === 'ADMIN_AUTHORIZED' ? ' · putusan admin' : ' · konfirmasi kedua pihak';
        result.timeline.push(entry);
      }
      return result;
    });
  }
  async photo(id: string, mediaId: string, response: Response) {
    validId(mediaId);
    const passport = await this.passport(id);
    if (!passport.media.some((m) => m.id === mediaId)) throw new AppException(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
    const asset = await this.db.mediaAsset.findFirst({ where: { id: mediaId, deletedAt: null, caseId: null, repairRecordId: null } });
    if (!asset) throw new AppException(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
    response.setHeader('Cache-Control', 'private, no-store'); response.type(asset.mime).send(await this.storage.read(asset.storageKey));
  }
  async impact(userId?: string, from?: string, to?: string): Promise<ImpactDto> {
    const range = period(from, to);
    return serial(this.db, async (tx) => {
      const grouped = await tx.impactEvent.groupBy({ by: ['metric', 'unit'], where: { attributedUserId: userId ?? null, occurredAt: range.filter }, _sum: { delta: true } });
      const transferred = await tx.transaction.findMany({ where: { status: 'COMPLETED', correctedAt: null, completedAt: range.filter, ...(userId ? { OR: [{ sellerOrDonorId: userId }, { buyerOrRecipientId: userId }] } : {}) }, select: { id: true, snapshot: true } });
      const weights = await tx.impactEvent.findMany({ where: { sourceType: 'TRANSACTION', metric: 'ESTIMATED_TRANSFER_WEIGHT', attributedUserId: userId ?? null, occurredAt: range.filter }, select: { sourceId: true, itemId: true } });
      const coverage = new Set(weights.map((e) => e.sourceId + ':' + e.itemId));
      let total = 0n; let known = 0n;
      for (const row of transferred) for (const item of (row.snapshot as unknown as TransactionSnapshot).items) {
        if (userId && item.fromUserId !== userId) continue;
        total++;
        if (coverage.has(row.id + ':' + item.id)) known++;
      }
      return { from: range.start?.toISOString() ?? null, to: range.end?.toISOString() ?? null, metrics: impactMetrics.map((metric) => { const match = grouped.find((g) => g.metric === metric); return { metric, value: metric === 'ESTIMATED_TRANSFER_WEIGHT' && known === 0n ? null : (match?._sum.delta ?? 0n).toString(), unit: metric === 'ESTIMATED_TRANSFER_WEIGHT' ? 'GRAM' : metric === 'CONFIRMED_SALE_VALUE' ? 'IDR' : 'COUNT' }; }), weightCoverage: { known: known.toString(), total: total.toString() }, notes: ['Repair dan estimasi berat dilaporkan pengguna.', 'Nilai Resell adalah harga final yang disepakati, bukan bukti pembayaran.', 'Platform dihitung dari kontribusi platform; kontribusi pengguna tidak dijumlahkan.', 'Koreksi berlaku pada periode kejadian aslinya.'] };
    });
  }
}
