import { expireOffers } from '../notifications/events.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { type ListingDto, type ListingSaveInput, uuidSchema, type ListingPatchInput } from '@valora/contracts';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { AppException } from '../../shared/http.js';
import { serial, lockRows } from '../../shared/transactions.js';
import { listingInclude, revisionDto, safetyFlags, recommendations, revisionInclude } from './shared.js';

type ListingRow = Prisma.ListingGetPayload<{ include: typeof listingInclude }>;

const rubricKey = (category: string, subcategory: string | null) => subcategory ? `${category}/${subcategory}` : category;

function listingDto(row: ListingRow): ListingDto {
  return {
    id: row.id, itemId: row.itemId, type: row.type, status: row.status, version: row.version,
    currentRevision: row.currentRevision ? revisionDto(row.currentRevision, row.id) : null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class ListingService {
  constructor(private readonly db: DatabaseService) {}

  private async assertVerified(userId: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
    if (!user?.emailVerifiedAt) throw new AppException(403, 'EMAIL_UNVERIFIED', 'Verifikasi email sebelum menggunakan pasar.');
  }

  private async currentAssessment(tx: Prisma.TransactionClient, userId: string, item: { id: string; categoryCode: string; subcategoryCode: string | null; itemRevision: number }, assessmentId: string, type: ListingSaveInput['type']) {
    const rubric = await tx.rubricVersion.findFirst({ where: { rubricKey: rubricKey(item.categoryCode, item.subcategoryCode), effectiveAt: { lte: new Date() } }, orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }] });
    if (!rubric) throw new AppException(422, 'ASSESSMENT_INCOMPLETE', 'Rubrik aktif belum tersedia untuk kategori Item.');
    const assessment = await tx.assessment.findFirst({ where: { valid: true, id: assessmentId, itemId: item.id, createdById: userId, itemRevision: item.itemRevision, rubricVersionId: rubric.id } });
    const latest = await tx.assessment.findFirst({ where: { valid: true, itemId: item.id, createdById: userId, itemRevision: item.itemRevision, rubricVersionId: rubric.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } });
    if (!assessment || latest?.id !== assessment.id) throw new AppException(422, 'STALE_ASSESSMENT', 'Gunakan penilaian terbaru untuk Item ini.');
    if (assessment.status === 'INCOMPLETE' || (type === 'RESELL' && assessment.status !== 'COMPLETE')) throw new AppException(422, 'ASSESSMENT_INCOMPLETE', type === 'RESELL' ? 'Resell memerlukan penilaian lengkap.' : 'Lengkapi data kondisi dan keselamatan terlebih dahulu.');
    const flags = safetyFlags(assessment);
    if (flags.some((flag) => flag.startsWith('PROHIBITED:'))) throw new AppException(422, 'ACTION_INELIGIBLE', 'Kondisi yang dilaporkan belum dapat ditawarkan menurut kebijakan kategori.', { riskFlags: flags.filter((flag) => flag.startsWith('PROHIBITED:')) });
    const action = type === 'RESELL' ? 'RESELL' : type;
    if (recommendations(assessment).find((entry) => entry.action === action)?.status !== 'ELIGIBLE') throw new AppException(422, 'ACTION_INELIGIBLE', 'Hasil penilaian belum mengizinkan jenis Listing ini.');
    return { assessment, rubric, flags };
  }

  private async createRevision(tx: Prisma.TransactionClient, userId: string, item: Prisma.ItemGetPayload<object>, input: ListingSaveInput, listingId: string, revisionNo: number, copyOnlyCorrection = false): Promise<void> {
    const { assessment, rubric, flags } = await this.currentAssessment(tx, userId, item, input.assessmentId, input.type);
    const media = await tx.mediaAsset.findMany({ where: { id: { in: input.mediaIds }, itemId: item.id, repairRecordId: null, caseId: null, deletedAt: null, OR: [{ uploadedById: userId }, { shareWithFutureOwner: true }] } });
    if (media.length !== input.mediaIds.length) throw new AppException(400, 'MEDIA_INVALID', 'Pilih foto aktif milik Item ini.');
    const city = await tx.city.findFirst({ where: { id: input.cityId, active: true }, select: { id: true } });
    if (!city) throw new AppException(400, 'INVALID_INPUT', 'Pilih kota yang tersedia.');
    const disclosureFlags = flags.filter((flag) => flag.startsWith('DISCLOSE:'));
    const riskFlags = flags.filter((flag) => flag.startsWith('SPECIAL_REVIEW:'));
    const revision = await tx.listingRevision.create({ data: {
      listingId, revisionNo, itemId: item.id, assessmentId: assessment.id, itemRevision: item.itemRevision,
      rubricVersionId: rubric.id, title: input.title, description: input.description,
      categoryCode: item.categoryCode, subcategoryCode: item.subcategoryCode, cityId: input.cityId,
      condition: assessment.condition!, score: assessment.score, scoreLabel: assessment.label,
      ruleVersion: rubric.ruleVersion, policyVersion: rubric.policyVersion,
      assessmentSnapshot: { status: assessment.status, safetyFlags: flags, missingFields: assessment.missingFields } as Prisma.InputJsonValue,
      conditionDisclosure: input.conditionDisclosure, askingPriceIdr: input.type === 'RESELL' ? BigInt(input.askingPriceIdr) : null,
      exchangePreference: input.type === 'EXCHANGE' ? input.exchangePreference : null,
      recipientNote: input.type === 'DONATE' ? input.recipientNote ?? null : null,
      handoverMethods: input.handoverMethods, copyOnlyCorrection, riskFlags: [...riskFlags, ...disclosureFlags], createdById: userId,
    } });
    await tx.listingRevisionMedia.createMany({ data: input.mediaIds.map((mediaId, orderIndex) => ({ revisionId: revision.id, mediaId, orderIndex })) });
    await tx.listing.update({ where: { id: listingId }, data: { currentRevisionId: revision.id, version: { increment: 1 } } });
  }

  async create(userId: string, itemId: string, input: ListingSaveInput): Promise<ListingDto> {
    await this.assertVerified(userId);
    if (!uuidSchema.safeParse(itemId).success) throw new AppException(404, 'NOT_FOUND', 'Item tidak ditemukan.');
    const id = await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [userId]);
      await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${itemId}::uuid FOR UPDATE`;
      const item = await tx.item.findFirst({ where: { id: itemId, currentOwnerId: userId, archivedAt: null } });
      if (!item) throw new AppException(404, 'NOT_FOUND', 'Item tidak ditemukan.');
      if (item.reservedByTransactionId) throw new AppException(409, 'ITEM_RESERVED', 'Item sedang dalam kesepakatan.');
      if (await tx.listing.findFirst({ where: { itemId, status: { notIn: ['WITHDRAWN', 'CLOSED'] } }, select: { id: true } })) throw new AppException(409, 'STATE_CONFLICT', 'Item ini sudah memiliki Listing. Kelola Listing yang ada atau tutup terlebih dahulu.');
      if (item.version !== input.expectedItemVersion) throw new AppException(409, 'STATE_CONFLICT', 'Item berubah. Muat ulang sebelum membuat Listing.');
      const listing = await tx.listing.create({ data: { itemId, ownerId: userId, type: input.type } });
      await this.createRevision(tx, userId, item, input, listing.id, 1);
      return listing.id;
    });
    return this.getOwner(userId, id);
  }

  async patch(userId: string, id: string, input: ListingPatchInput): Promise<ListingDto> {
    await this.assertVerified(userId);
    const updatedId = await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [userId]);
      const ref = await tx.listing.findFirst({ where: { id, ownerId: userId }, select: { itemId: true } });
      if (!ref) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
      await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${ref.itemId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${id}::uuid FOR UPDATE`;
      const listing = await tx.listing.findFirst({ where: { id, ownerId: userId }, include: { currentRevision: { include: revisionInclude }, item: true } });
      if (!listing) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
      if (listing.status === 'RESERVED' || listing.status === 'CLOSED' || listing.status === 'WITHDRAWN' || listing.status === 'SUSPENDED') throw new AppException(409, 'STATE_CONFLICT', 'Listing tidak dapat diubah pada status ini.');
      if (listing.version !== input.expectedVersion) throw new AppException(409, 'STATE_CONFLICT', 'Listing berubah. Muat ulang sebelum menyimpan.');
      if (listing.type !== input.type) throw new AppException(400, 'INVALID_INPUT', 'Jenis Listing tidak dapat diubah.');
      const item = await tx.item.findFirst({ where: { id: listing.itemId, currentOwnerId: userId, archivedAt: null } });
      if (!item || item.reservedByTransactionId) throw new AppException(409, 'ITEM_RESERVED', 'Item tidak dapat ditawarkan saat ini.');
      if (item.version !== input.expectedItemVersion) throw new AppException(409, 'STATE_CONFLICT', 'Item berubah. Muat ulang sebelum menyimpan.');
      const previous = listing.currentRevision;
      if (!previous) throw new AppException(409, 'STATE_CONFLICT', 'Listing belum memiliki revisi.');
      const sameSnapshot = previous.itemRevision === item.itemRevision
        && JSON.stringify(previous.media.map((entry) => entry.mediaId)) === JSON.stringify(input.mediaIds)
        && previous.cityId === input.cityId && previous.conditionDisclosure === input.conditionDisclosure
        && previous.askingPriceIdr === (input.type === 'RESELL' ? BigInt(input.askingPriceIdr) : null)
        && previous.exchangePreference === (input.type === 'EXCHANGE' ? input.exchangePreference : null)
        && previous.recipientNote === (input.type === 'DONATE' ? input.recipientNote ?? null : null)
        && JSON.stringify(previous.handoverMethods) === JSON.stringify(input.handoverMethods);
      if (input.copyOnlyCorrection && !sameSnapshot) throw new AppException(400, 'INVALID_INPUT', 'Koreksi teks saja tidak boleh mengubah fakta Listing.');
      if ((listing.status === 'ACTIVE' || listing.status === 'PAUSED') && !sameSnapshot && input.assessmentId === previous.assessmentId) throw new AppException(422, 'STALE_ASSESSMENT', 'Perubahan Listing memerlukan penilaian baru.');
      if (listing.status === 'ACTIVE') {
        await tx.listing.update({ where: { id }, data: { status: 'PAUSED', publishedAt: null, version: { increment: 1 } } });
        await expireOffers(tx, { listingId: id, status: { in: ['PENDING', 'COUNTERED'] } }, 'LISTING_REVISED');
      }
      if (listing.status === 'PENDING_REVIEW' || listing.status === 'REJECTED') await tx.listing.update({ where: { id }, data: { status: 'DRAFT', version: { increment: 1 } } });
      const nextNo = (await tx.listingRevision.aggregate({ where: { listingId: id }, _max: { revisionNo: true } }))._max.revisionNo ?? 0;
      await this.createRevision(tx, userId, item, input, id, nextNo + 1, input.copyOnlyCorrection);
      return id;
    });
    return this.getOwner(userId, updatedId);
  }

  async submit(userId: string, id: string, expectedVersion: number): Promise<ListingDto> {
    await this.assertVerified(userId);
    await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [userId]);
      const ref = await tx.listing.findFirst({ where: { id, ownerId: userId }, select: { itemId: true } });
      if (!ref) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
      await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${ref.itemId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${id}::uuid FOR UPDATE`;
      const listing = await tx.listing.findFirst({ where: { id, ownerId: userId }, include: { currentRevision: true, item: true } });
      if (!listing) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
      if (listing.status === 'PENDING_REVIEW' && listing.version === expectedVersion) return;
      if (listing.version !== expectedVersion) throw new AppException(409, 'STATE_CONFLICT', 'Listing berubah. Muat ulang sebelum mengirim.');
      if (!['DRAFT', 'PAUSED', 'REJECTED'].includes(listing.status) || !listing.currentRevision) throw new AppException(409, 'STATE_CONFLICT', 'Listing belum dapat diajukan.');
      if (listing.item.currentOwnerId !== userId || listing.item.archivedAt || listing.item.reservedByTransactionId) throw new AppException(409, 'STATE_CONFLICT', 'Item tidak lagi dapat ditawarkan.');
      if (await tx.listing.findFirst({ where: { itemId: listing.itemId, id: { not: id }, status: { notIn: ['WITHDRAWN', 'CLOSED'] } }, select: { id: true } })) throw new AppException(409, 'STATE_CONFLICT', 'Item ini sudah terhubung dengan Listing lain.');
      if (listing.currentRevision.itemRevision !== listing.item.itemRevision) throw new AppException(422, 'STALE_ASSESSMENT', 'Perbarui penilaian dan revisi Listing sebelum mengirim.');
      const current = await this.currentAssessment(tx, userId, listing.item, listing.currentRevision.assessmentId, listing.type);
      if (current.rubric.id !== listing.currentRevision.rubricVersionId) throw new AppException(422, 'STALE_ASSESSMENT', 'Rubrik Listing sudah berubah.');
      const photoCount = await tx.listingRevisionMedia.count({ where: { revisionId: listing.currentRevisionId!, media: { deletedAt: null, itemId: listing.itemId, repairRecordId: null, caseId: null } } });
      if (photoCount < 1) throw new AppException(422, 'ACTION_NEEDS_DATA', 'Listing memerlukan sedikitnya satu foto Item.');
      await tx.listing.update({ where: { id }, data: { status: 'PENDING_REVIEW', version: { increment: 1 }, closedAt: null } });
    });
    return this.getOwner(userId, id);
  }

  async withdraw(userId: string, id: string, expectedVersion: number): Promise<ListingDto> {
    await this.assertVerified(userId);
    await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [userId]);
      await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${id}::uuid FOR UPDATE`;
      const listing = await tx.listing.findFirst({ where: { id, ownerId: userId } });
      if (!listing) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
      if (listing.version !== expectedVersion || !['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'REJECTED'].includes(listing.status)) throw new AppException(409, 'STATE_CONFLICT', 'Listing tidak dapat ditarik pada status ini.');
      await tx.listing.update({ where: { id }, data: { status: 'WITHDRAWN', publishedAt: null, closedAt: new Date(), version: { increment: 1 } } });
      await expireOffers(tx, { listingId: id, status: { in: ['PENDING', 'COUNTERED'] } }, 'LISTING_WITHDRAWN');
    });
    return this.getOwner(userId, id);
  }

  async getOwner(userId: string, id: string): Promise<ListingDto> {
    const row = await this.db.listing.findFirst({ where: { id, ownerId: userId }, include: listingInclude });
    if (!row) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
    return listingDto(row);
  }

  async listMine(userId: string): Promise<ListingDto[]> {
    const rows = await this.db.listing.findMany({ where: { ownerId: userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 100, include: listingInclude });
    return rows.map(listingDto);
  }
}
