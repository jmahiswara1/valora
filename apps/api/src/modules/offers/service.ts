import { expireOffers, notify } from '../notifications/events.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { createHash } from 'node:crypto';
import { type OfferDto, type TransactionItemSnapshot, type ListingOfferInput, uuidSchema, type OfferCounterInput } from '@valora/contracts';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { AppException } from '../../shared/http.js';
import { serial, lockRows, eligible, json } from '../../shared/transactions.js';

const offerInclude = {
  transaction: { select: { id: true } },
  listing: { include: { currentRevision: true } },
  listingRevision: true,
  revisions: { orderBy: { revisionNo: 'desc' as const }, take: 1 },
} satisfies Prisma.OfferInclude;

type OfferRow = Prisma.OfferGetPayload<{ include: typeof offerInclude }>;

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function offerDto(row: OfferRow): OfferDto {
  const latest = row.revisions[0];
  return {
    id: row.id, listingId: row.listingId, listingRevisionId: row.listingRevisionId,
    bidderId: row.bidderId, exchangeItemId: row.exchangeItemId, status: row.status,
    exchangeSnapshot: row.exchangeSnapshot as unknown as TransactionItemSnapshot | null, transactionId: row.transaction?.id ?? null,
    endReason: row.endReason, expiresAt: row.expiresAt.toISOString(), version: row.version,
    currentRevision: latest ? { id: latest.id, revisionNo: latest.revisionNo, priceIdr: latest.priceIdr === null ? null : Number(latest.priceIdr), message: latest.message, proposedById: latest.proposedById, respondsById: latest.respondsById, createdAt: latest.createdAt.toISOString(), expiresAt: latest.expiresAt.toISOString() } : null,
    createdAt: row.createdAt.toISOString(), listing: { title: row.listingRevision.title, type: row.listing.type },
  };
}

@Injectable()
export class OffersService {
  constructor(private readonly db: DatabaseService) {}

  private async requireVerified(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true, status: true } });
    if (!user || user.status !== 'ACTIVE') throw new AppException(403, 'FORBIDDEN', 'Akun ini tidak dapat menggunakan Market.');
    if (!user.emailVerifiedAt) throw new AppException(403, 'EMAIL_UNVERIFIED', 'Verifikasi email sebelum mengirim penawaran.');
  }

  private async hasBlock(tx: Prisma.TransactionClient, first: string, second: string) {
    return Boolean(await tx.userBlock.findFirst({ where: { revokedAt: null, OR: [{ blockerId: first, blockedId: second }, { blockerId: second, blockedId: first }] }, select: { id: true } }));
  }

  private async assertExchangeItem(tx: Prisma.TransactionClient, userId: string, itemId: string, listingItemId: string) {
    if (itemId === listingItemId) throw new AppException(400, 'INVALID_INPUT', 'Item yang ditawarkan harus berbeda.');
    const item = await tx.item.findFirst({ where: { id: itemId, currentOwnerId: userId, archivedAt: null, reservedByTransactionId: null } });
    if (!item) throw new AppException(404, 'NOT_FOUND', 'Item penukar tidak ditemukan.');
    const activeListing = await tx.listing.findFirst({ where: { itemId, status: { in: ['ACTIVE', 'RESERVED'] } }, select: { id: true } });
    if (activeListing) throw new AppException(409, 'STATE_CONFLICT', 'Tarik Listing aktif Item ini sebelum menggunakannya untuk Exchange.');
    const key = item.subcategoryCode ? `${item.categoryCode}/${item.subcategoryCode}` : item.categoryCode;
    const rubric = await tx.rubricVersion.findFirst({ where: { rubricKey: key, effectiveAt: { lte: new Date() } }, orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }] });
    if (!rubric) throw new AppException(422, 'ASSESSMENT_INCOMPLETE', 'Rubrik aktif belum tersedia untuk Item penukar.');
    const assessment = await tx.assessment.findFirst({ where: { valid: true, itemId, createdById: userId, itemRevision: item.itemRevision, rubricVersionId: rubric.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    if (!assessment || assessment.status === 'INCOMPLETE') throw new AppException(422, 'ASSESSMENT_INCOMPLETE', 'Item penukar memerlukan Assessment terkini.');
    const flags = assessment.safetyFlags as string[];
    const actions = assessment.recommendationSnapshot as { action: string; status: string }[];
    if (flags.some((flag) => flag.startsWith('PROHIBITED:')) || actions.find((entry) => entry.action === 'EXCHANGE')?.status !== 'ELIGIBLE') throw new AppException(422, 'ACTION_INELIGIBLE', 'Item penukar belum memenuhi syarat Exchange.');
  }

  async create(userId: string, listingId: string, input: ListingOfferInput): Promise<OfferDto> {
    await this.requireVerified(userId);
    if (!uuidSchema.safeParse(listingId).success) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
    const requestHash = hash(input);
    return serial(this.db, async (tx) => {
      const prior = await tx.offer.findUnique({ where: { clientRequestId: input.clientRequestId }, include: offerInclude });
      if (prior) {
        if (prior.bidderId !== userId || prior.listingId !== listingId || prior.requestHash !== requestHash) throw new AppException(409, 'IDEMPOTENCY_CONFLICT', 'ID permintaan telah dipakai untuk penawaran lain.');
        return offerDto(prior);
      }
      const ref = await tx.listing.findUnique({ where: { id: listingId } });
      if (!ref) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
      await lockRows(tx, 'User', [userId, ref.ownerId]);
      await lockRows(tx, 'Item', [ref.itemId, ...(input.exchangeItemId ? [input.exchangeItemId] : [])]);
      await lockRows(tx, 'Listing', [listingId]);
      const racedPrior = await tx.offer.findUnique({ where: { clientRequestId: input.clientRequestId }, include: offerInclude });
      if (racedPrior) {
        if (racedPrior.bidderId !== userId || racedPrior.listingId !== listingId || racedPrior.requestHash !== requestHash) throw new AppException(409, 'IDEMPOTENCY_CONFLICT', 'ID permintaan telah dipakai untuk penawaran lain.');
        return offerDto(racedPrior);
      }
      const listing = await tx.listing.findUnique({ where: { id: listingId }, include: { currentRevision: true } });
      if (!listing || listing.status !== 'ACTIVE' || !listing.currentRevision) throw new AppException(404, 'NOT_FOUND', 'Listing tidak tersedia.');
      if (listing.ownerId === userId) throw new AppException(403, 'FORBIDDEN', 'Kamu tidak dapat menawar Listing sendiri.');
      if (listing.version !== input.expectedListingVersion || input.listingRevisionId !== listing.currentRevision.id) throw new AppException(409, 'STATE_CONFLICT', 'Listing berubah. Muat ulang sebelum menawar.');
      if (await this.hasBlock(tx, userId, listing.ownerId)) throw new AppException(403, 'FORBIDDEN', 'Interaksi dengan akun ini dibatasi.');
      const category = await tx.category.findUnique({ where: { code: listing.currentRevision.categoryCode } });
      const subcategory = listing.currentRevision.subcategoryCode ? await tx.category.findUnique({ where: { code: listing.currentRevision.subcategoryCode } }) : null;
      if (!category?.active || (listing.currentRevision.subcategoryCode && !subcategory?.active)) throw new AppException(422, 'ACTION_INELIGIBLE', 'Kategori dinonaktifkan.');
      const price = input.priceIdr ?? null;
      const exchangeItemId = input.exchangeItemId ?? null;
      if (listing.type === 'RESELL' && (price === null || exchangeItemId !== null)) throw new AppException(400, 'INVALID_INPUT', 'Resell memerlukan nominal dan tidak menerima Item penukar.');
      if (listing.type === 'EXCHANGE' && (price !== null || exchangeItemId === null)) throw new AppException(400, 'INVALID_INPUT', 'Exchange memerlukan satu Item penukar dan tidak menerima uang.');
      if (listing.type === 'DONATE' && (price !== null || exchangeItemId !== null)) throw new AppException(400, 'INVALID_INPUT', 'Donate tidak menerima nominal atau Item pengganti.');
      let exchangeSnapshot: TransactionItemSnapshot | undefined;
      if (exchangeItemId) {
        await this.assertExchangeItem(tx, userId, exchangeItemId, listing.currentRevision.itemId);
        const { item, assessment } = await eligible(tx, exchangeItemId, userId, 'EXCHANGE');
        const photos = await tx.mediaAsset.findMany({ where: { itemId: item.id, deletedAt: null, repairRecordId: null, caseId: null, OR: [{ uploadedById: userId }, { shareWithFutureOwner: true }] }, orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }] });
        exchangeSnapshot = { id: item.id, itemRevision: item.itemRevision, assessmentId: assessment.id, title: item.title, description: item.description, conditionSummary: item.conditionSummary, categoryCode: item.categoryCode, subcategoryCode: item.subcategoryCode, estimatedWeightGrams: item.estimatedWeightGrams, mediaIds: photos.map((p) => p.id), fromUserId: userId, toUserId: listing.ownerId };
      }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const offer = await tx.offer.create({ data: {
        listingId, listingRevisionId: listing.currentRevision.id, bidderId: userId,
        exchangeItemId, exchangeSnapshot: exchangeSnapshot ? json(exchangeSnapshot) : undefined, clientRequestId: input.clientRequestId, requestHash, expiresAt,
        revisions: { create: { revisionNo: 1, priceIdr: price === null ? null : BigInt(price), message: input.message ?? null, proposedById: userId, respondsById: listing.ownerId, expiresAt } },
      }, include: offerInclude });
      await notify(tx, 'OFFER_RECEIVED', `offer:${offer.id}:created`, [listing.ownerId], { offerId: offer.id, title: listing.currentRevision.title });
      return offerDto(offer);
    });
  }

  async listMine(userId: string): Promise<OfferDto[]> {
    const rows = await this.db.offer.findMany({ where: { OR: [{ bidderId: userId }, { listing: { ownerId: userId } }] }, include: offerInclude, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 100 });
    const now = new Date();
    const expired = rows.filter((row) => ['PENDING', 'COUNTERED'].includes(row.status) && row.expiresAt <= now);
    if (!expired.length) return rows.map(offerDto);
    await serial(this.db, tx => expireOffers(tx, { id: { in: expired.map(row => row.id) }, expiresAt: { lte: now } }, 'TIMEOUT'));
    const fresh = await this.db.offer.findMany({ where: { id: { in: rows.map(row => row.id) } }, include: offerInclude, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] });
    return fresh.map(offerDto);
  }

  async get(userId: string, id: string): Promise<OfferDto> {
    if (!uuidSchema.safeParse(id).success) throw new AppException(404, 'NOT_FOUND', 'Penawaran tidak ditemukan.');
    const row = await this.db.offer.findUnique({ where: { id }, include: offerInclude });
    if (!row || (row.bidderId !== userId && row.listing.ownerId !== userId)) throw new AppException(404, 'NOT_FOUND', 'Penawaran tidak ditemukan.');
    if (['PENDING', 'COUNTERED'].includes(row.status) && row.expiresAt <= new Date()) {
      await serial(this.db, tx => expireOffers(tx, { id, expiresAt: { lte: new Date() } }, 'TIMEOUT'));
      return offerDto(await this.db.offer.findUniqueOrThrow({ where: { id }, include: offerInclude }));
    }
    return offerDto(row);
  }

  async counter(userId: string, id: string, input: OfferCounterInput): Promise<OfferDto> {
    await this.requireVerified(userId);
    const updated = await serial(this.db, async (tx) => {
      const ref = await tx.offer.findUnique({ where: { id }, include: { listing: true } });
      if (!ref) throw new AppException(404, 'NOT_FOUND', 'Penawaran tidak ditemukan.');
      await lockRows(tx, 'User', [ref.bidderId, ref.listing.ownerId]);
      await lockRows(tx, 'Item', [ref.listing.itemId, ...(ref.exchangeItemId ? [ref.exchangeItemId] : [])]);
      await lockRows(tx, 'Listing', [ref.listingId]);
      await lockRows(tx, 'Offer', [id]);
      const row = await tx.offer.findUnique({ where: { id }, include: offerInclude });
      if (!row || (row.bidderId !== userId && row.listing.ownerId !== userId)) throw new AppException(404, 'NOT_FOUND', 'Penawaran tidak ditemukan.');
      const previous = row.revisions[0];
      if (!previous || !['PENDING', 'COUNTERED'].includes(row.status) || row.version !== input.expectedVersion || previous.respondsById !== userId) throw new AppException(409, 'STATE_CONFLICT', 'Penawaran tidak dapat ditanggapi saat ini.');
      if (row.expiresAt <= new Date()) throw new AppException(410, 'OFFER_EXPIRED', 'Masa penawaran sudah berakhir.');
      if (row.listing.status !== 'ACTIVE' || row.listing.currentRevisionId !== row.listingRevisionId) throw new AppException(409, 'STATE_CONFLICT', 'Listing tidak menerima tanggapan baru.');
      if (row.listing.type !== 'RESELL') throw new AppException(400, 'INVALID_INPUT', 'Counteroffer harga hanya tersedia untuk Resell.');
      if (await this.hasBlock(tx, userId, row.bidderId)) throw new AppException(403, 'FORBIDDEN', 'Interaksi dengan akun ini dibatasi.');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await tx.offerRevision.create({ data: { offerId: id, revisionNo: row.currentRevisionNo + 1, priceIdr: BigInt(input.priceIdr), message: input.message ?? null, proposedById: userId, respondsById: previous.proposedById, expiresAt } });
      await tx.offer.update({ where: { id }, data: { status: 'COUNTERED', currentRevisionNo: { increment: 1 }, expiresAt, endReason: null, version: { increment: 1 } } });
      await notify(tx, 'OFFER_COUNTERED', `offer:${id}:revision:${row.currentRevisionNo + 1}`, [previous.proposedById], { offerId: id, title: row.listingRevision.title });
      return tx.offer.findUniqueOrThrow({ where: { id }, include: offerInclude });
    });
    return offerDto(updated);
  }

  async reject(userId: string, id: string, expectedVersion: number): Promise<OfferDto> {
    return this.finish(userId, id, expectedVersion, 'REJECTED');
  }

  async withdraw(userId: string, id: string, expectedVersion: number): Promise<OfferDto> {
    return this.finish(userId, id, expectedVersion, 'WITHDRAWN');
  }

  private async finish(userId: string, id: string, expectedVersion: number, result: 'REJECTED' | 'WITHDRAWN'): Promise<OfferDto> {
    await this.requireVerified(userId);
    const updated = await serial(this.db, async (tx) => {
      const ref = await tx.offer.findUnique({ where: { id }, include: { listing: true } });
      if (!ref) throw new AppException(404, 'NOT_FOUND', 'Penawaran tidak ditemukan.');
      await lockRows(tx, 'User', [ref.bidderId, ref.listing.ownerId]);
      await lockRows(tx, 'Item', [ref.listing.itemId, ...(ref.exchangeItemId ? [ref.exchangeItemId] : [])]);
      await lockRows(tx, 'Listing', [ref.listingId]);
      await lockRows(tx, 'Offer', [id]);
      const row = await tx.offer.findUnique({ where: { id }, include: offerInclude });
      if (!row || (result === 'REJECTED' ? row.revisions[0]?.respondsById !== userId : row.bidderId !== userId)) throw new AppException(404, 'NOT_FOUND', 'Penawaran tidak ditemukan.');
      if (!['PENDING', 'COUNTERED'].includes(row.status) || row.version !== expectedVersion) throw new AppException(409, 'STATE_CONFLICT', 'Penawaran sudah berubah atau berakhir.');
      if (row.expiresAt <= new Date()) throw new AppException(410, 'OFFER_EXPIRED', 'Masa penawaran sudah berakhir.');
      await tx.offer.update({ where: { id }, data: { status: result, endReason: result, version: { increment: 1 } } });
      await notify(tx, result === 'REJECTED' ? 'OFFER_REJECTED' : 'OFFER_WITHDRAWN', `offer:${id}:${result}:${row.version + 1}`, [row.bidderId, row.listing.ownerId], { offerId: id, title: row.listingRevision.title }, userId);
      return tx.offer.findUniqueOrThrow({ where: { id }, include: offerInclude });
    });
    return offerDto(updated);
  }
}
