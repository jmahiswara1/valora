import { expireOffers, notify } from '../notifications/events.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { createHash } from 'node:crypto';
import { type OfferDto, type TransactionItemSnapshot, type ExchangeTerms, type ExchangeCandidateDto, type OfferRevisionDto, type ListingOfferInput, uuidSchema, type OfferCounterInput } from '@valora/contracts';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { AppException } from '../../shared/http.js';
import { serial, lockRows, json } from '../../shared/transactions.js';
import { exchangeHash, exchangeItems, exchangeSnapshot, validateExchange } from '../../shared/exchange.js';
import { ItemsService } from '../items/service.js';

const offerInclude = {
  transaction: { select: { id: true } },
  listing: { include: { currentRevision: true } },
  listingRevision: true,
  currentRevision: true,
  revisions: { orderBy: { revisionNo: 'desc' as const }, take: 1 },
} satisfies Prisma.OfferInclude;

type OfferRow = Prisma.OfferGetPayload<{ include: typeof offerInclude }>;

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function offerDto(row: OfferRow): OfferDto {
  const latest = row.currentRevision ?? row.revisions[0];
  return {
    id: row.id, listingId: row.listingId, listingRevisionId: row.listingRevisionId,
    bidderId: row.bidderId, exchangeItemId: row.exchangeItemId, status: row.status,
    exchangeSnapshot: row.exchangeSnapshot as unknown as TransactionItemSnapshot | null, transactionId: row.transaction?.id ?? null,
    endReason: row.endReason, expiresAt: row.expiresAt.toISOString(), version: row.version,
    currentRevision: latest ? revisionDto(latest) : null,
    createdAt: row.createdAt.toISOString(), listing: { title: row.listingRevision.title, type: row.listing.type },
  };
}

function revisionDto(row: Prisma.OfferRevisionGetPayload<object>): OfferRevisionDto {
  const terms = row.exchangeTerms as unknown as ExchangeTerms | null;
  return { id: row.id, revisionNo: row.revisionNo, priceIdr: row.priceIdr === null ? null : Number(row.priceIdr), message: row.message, proposedById: row.proposedById,
    respondsById: row.respondsById, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString(), exchangeTerms: terms, termsHash: terms ? exchangeHash(terms) : null };
}

@Injectable()
export class OffersService {
  constructor(private readonly db: DatabaseService, private readonly items: ItemsService) {}

  private async parties(tx: Prisma.TransactionClient, ownerId: string, bidderId: string) {
    const users = await tx.user.findMany({ where: { id: { in: [ownerId, bidderId] } } });
    if (users.length !== 2 || users.some(user => user.status !== 'ACTIVE' || !user.emailVerifiedAt)) throw new AppException(403, 'FORBIDDEN', 'Kedua akun harus aktif dan terverifikasi.');
    if (await this.hasBlock(tx, ownerId, bidderId)) throw new AppException(403, 'FORBIDDEN', 'Interaksi antar akun dibatasi.');
  }

  async candidates(userId: string, listingId: string, limit?: string, cursor?: string) {
    await this.requireVerified(userId);
    if (!uuidSchema.safeParse(listingId).success) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
    const page = await this.items.list(userId, limit, cursor);
    return serial(this.db, async tx => {
      const listing = await tx.listing.findFirst({ where: { id: listingId, type: 'EXCHANGE', status: 'ACTIVE' }, include: { currentRevision: { include: { media: true } } } });
      if (!listing?.currentRevision) throw new AppException(404, 'NOT_FOUND', 'Listing Exchange tidak tersedia.');
      if (await this.hasBlock(tx, userId, listing.ownerId)) throw new AppException(403, 'FORBIDDEN', 'Interaksi dengan akun ini dibatasi.');
      const data: ExchangeCandidateDto[] = [];
      for (const item of page.data) {
        try { await exchangeSnapshot(tx, item.id, userId, listing.ownerId === userId ? userId : listing.ownerId, listing); data.push({ item, eligible: true, reason: null }); }
        catch (cause) { if (!(cause instanceof AppException)) throw cause; data.push({ item, eligible: false, reason: cause.message }); }
      }
      return { data, meta: page.meta };
    });
  }

  async history(userId: string, id: string, limit = 20, cursor?: string) {
    if (!uuidSchema.safeParse(id).success) throw new AppException(404, 'NOT_FOUND', 'Penawaran tidak ditemukan.');
    let before: { createdAt: Date; id: string } | null = null;
    if (cursor) {
      try { const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); if (!uuidSchema.safeParse(value.id).success || !Number.isFinite(Date.parse(value.createdAt))) throw new Error(); before = { createdAt: new Date(value.createdAt), id: value.id }; }
      catch { throw new AppException(400, 'INVALID_INPUT', 'Cursor revisi tidak valid.'); }
    }
    return serial(this.db, async tx => {
      const offer = await tx.offer.findFirst({ where: { id, OR: [{ bidderId: userId }, { listing: { ownerId: userId } }] } });
      if (!offer) throw new AppException(404, 'NOT_FOUND', 'Penawaran tidak ditemukan.');
      const rows = await tx.offerRevision.findMany({ where: { offerId: id, ...(before ? { OR: [{ createdAt: { lt: before.createdAt } }, { createdAt: before.createdAt, id: { lt: before.id } }] } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1 });
      const page = rows.slice(0, limit), last = page.at(-1);
      return { data: page.map(revisionDto), meta: { nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id })).toString('base64url') : null } };
    });
  }

  private async requireVerified(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true, status: true } });
    if (!user || user.status !== 'ACTIVE') throw new AppException(403, 'FORBIDDEN', 'Akun ini tidak dapat menggunakan Market.');
    if (!user.emailVerifiedAt) throw new AppException(403, 'EMAIL_UNVERIFIED', 'Verifikasi email sebelum mengirim penawaran.');
  }

  private async hasBlock(tx: Prisma.TransactionClient, first: string, second: string) {
    return Boolean(await tx.userBlock.findFirst({ where: { revokedAt: null, OR: [{ blockerId: first, blockedId: second }, { blockerId: second, blockedId: first }] }, select: { id: true } }));
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
      const offeredIds = input.exchangeItemIds ?? (input.exchangeItemId ? [input.exchangeItemId] : []);
      await lockRows(tx, 'Item', [ref.itemId, ...offeredIds]);
      await lockRows(tx, 'Listing', [listingId]);
      const racedPrior = await tx.offer.findUnique({ where: { clientRequestId: input.clientRequestId }, include: offerInclude });
      if (racedPrior) {
        if (racedPrior.bidderId !== userId || racedPrior.listingId !== listingId || racedPrior.requestHash !== requestHash) throw new AppException(409, 'IDEMPOTENCY_CONFLICT', 'ID permintaan telah dipakai untuk penawaran lain.');
        return offerDto(racedPrior);
      }
      const listing = await tx.listing.findUnique({ where: { id: listingId }, include: { currentRevision: { include: { media: true } } } });
      if (!listing || listing.status !== 'ACTIVE' || !listing.currentRevision) throw new AppException(404, 'NOT_FOUND', 'Listing tidak tersedia.');
      if (listing.ownerId === userId) throw new AppException(403, 'FORBIDDEN', 'Kamu tidak dapat menawar Listing sendiri.');
      if (listing.version !== input.expectedListingVersion || input.listingRevisionId !== listing.currentRevision.id) throw new AppException(409, 'STATE_CONFLICT', 'Listing berubah. Muat ulang sebelum menawar.');
      if (await this.hasBlock(tx, userId, listing.ownerId)) throw new AppException(403, 'FORBIDDEN', 'Interaksi dengan akun ini dibatasi.');
      const category = await tx.category.findUnique({ where: { code: listing.currentRevision.categoryCode } });
      const subcategory = listing.currentRevision.subcategoryCode ? await tx.category.findUnique({ where: { code: listing.currentRevision.subcategoryCode } }) : null;
      if (!category?.active || (listing.currentRevision.subcategoryCode && !subcategory?.active)) throw new AppException(422, 'ACTION_INELIGIBLE', 'Kategori dinonaktifkan.');
      const price = input.priceIdr ?? null;
      const exchangeItemId = offeredIds[0] ?? null;
      if (listing.type !== 'EXCHANGE' && (input.exchangeItemIds || input.cashAdjustment)) throw new AppException(400, 'INVALID_INPUT', 'Paket dan tambahan uang hanya tersedia untuk Exchange.');
      if (listing.type === 'RESELL' && (price === null || exchangeItemId !== null)) throw new AppException(400, 'INVALID_INPUT', 'Resell memerlukan nominal dan tidak menerima Item penukar.');
      if (listing.type === 'EXCHANGE' && (price !== null || exchangeItemId === null)) throw new AppException(400, 'INVALID_INPUT', 'Exchange memerlukan satu sampai tiga barang penukar.');
      if (listing.type === 'DONATE' && (price !== null || exchangeItemId !== null)) throw new AppException(400, 'INVALID_INPUT', 'Donate tidak menerima nominal atau Item pengganti.');
      let terms: ExchangeTerms | null = null;
      if (listing.type === 'EXCHANGE') {
        await this.parties(tx, listing.ownerId, userId);
        const ownerItems = [await exchangeSnapshot(tx, listing.itemId, listing.ownerId, userId, listing)];
        const bidderItems = []; for (const id of offeredIds) bidderItems.push(await exchangeSnapshot(tx, id, userId, listing.ownerId, listing));
        terms = { ownerItems, bidderItems, cashAdjustment: input.cashAdjustment ?? null };
        await validateExchange(tx, terms, listing, userId);
      }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const created = await tx.offer.create({ data: {
        listingId, listingRevisionId: listing.currentRevision.id, bidderId: userId,
        exchangeItemId, exchangeSnapshot: terms ? json(terms.bidderItems[0]) : undefined, clientRequestId: input.clientRequestId, requestHash, expiresAt,
        revisions: { create: { revisionNo: 1, priceIdr: price === null ? null : BigInt(price), message: input.message ?? null, proposedById: userId, respondsById: listing.ownerId, expiresAt,
          ...(terms ? { exchangeTerms: json(terms), items: { create: exchangeItems(terms).map(item => ({ itemId: item.id })) } } : {}) } },
      }, include: offerInclude });
      const offer = await tx.offer.update({ where: { id: created.id }, data: { currentRevisionId: created.revisions[0].id }, include: offerInclude });
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
      const ref = await tx.offer.findUnique({ where: { id }, include: { listing: true, currentRevision: true } });
      if (!ref) throw new AppException(404, 'NOT_FOUND', 'Penawaran tidak ditemukan.');
      if (![ref.bidderId, ref.listing.ownerId].includes(userId)) throw new AppException(404, 'NOT_FOUND', 'Penawaran tidak ditemukan.');
      if (input.clientRequestId) {
        const prior = await tx.offerRevision.findUnique({ where: { clientRequestId: input.clientRequestId } });
        if (prior) {
          if (prior.offerId !== id || prior.proposedById !== userId || prior.requestHash !== hash(input)) throw new AppException(409, 'IDEMPOTENCY_CONFLICT', 'ID permintaan telah dipakai dengan data lain.');
          return tx.offer.findUniqueOrThrow({ where: { id }, include: offerInclude });
        }
      }
      await lockRows(tx, 'User', [ref.bidderId, ref.listing.ownerId]);
      const captured = ref.currentRevision?.exchangeTerms as unknown as ExchangeTerms | null;
      await lockRows(tx, 'Item', [ref.listing.itemId, ...(captured ? exchangeItems(captured).map(item => item.id) : ref.exchangeItemId ? [ref.exchangeItemId] : []), ...(input.exchangeItemIds ?? [])]);
      await lockRows(tx, 'Listing', [ref.listingId]);
      await lockRows(tx, 'Offer', [id]);
      const row = await tx.offer.findUnique({ where: { id }, include: offerInclude });
      if (!row || (row.bidderId !== userId && row.listing.ownerId !== userId)) throw new AppException(404, 'NOT_FOUND', 'Penawaran tidak ditemukan.');
      const previous = row.currentRevision ?? row.revisions[0];
      if (!previous || !['PENDING', 'COUNTERED'].includes(row.status) || row.version !== input.expectedVersion || previous.respondsById !== userId) throw new AppException(409, 'STATE_CONFLICT', 'Penawaran tidak dapat ditanggapi saat ini.');
      if (row.expiresAt <= new Date()) throw new AppException(410, 'OFFER_EXPIRED', 'Masa penawaran sudah berakhir.');
      if (row.listing.status !== 'ACTIVE' || row.listing.currentRevisionId !== row.listingRevisionId) throw new AppException(409, 'STATE_CONFLICT', 'Listing tidak menerima tanggapan baru.');
      if (!['RESELL', 'EXCHANGE'].includes(row.listing.type)) throw new AppException(400, 'INVALID_INPUT', 'Donate tidak menerima counteroffer.');
      await this.parties(tx, row.listing.ownerId, row.bidderId);
      let terms: ExchangeTerms | null = null;
      if (row.listing.type === 'EXCHANGE') {
        if (!input.exchangeItemIds || input.cashAdjustment === undefined || input.priceIdr !== undefined) throw new AppException(400, 'INVALID_INPUT', 'Isi paket Exchange dan tambahan uang.');
        const last = previous.exchangeTerms as unknown as ExchangeTerms | null;
        if (!last) throw new AppException(409, 'STATE_CONFLICT', 'Kirim ulang penawaran Exchange yang belum memiliki snapshot lengkap.');
        const listing = await tx.listing.findUniqueOrThrow({ where: { id: row.listingId }, include: { currentRevision: { include: { media: true } } } });
        const owner = userId === listing.ownerId;
        if (owner && !input.exchangeItemIds.includes(listing.itemId)) throw new AppException(400, 'INVALID_INPUT', 'Barang utama Listing wajib tetap disertakan.');
        const ids = owner ? [listing.itemId, ...input.exchangeItemIds.filter(value => value !== listing.itemId)] : input.exchangeItemIds;
        const own = []; for (const itemId of ids) own.push(await exchangeSnapshot(tx, itemId, userId, owner ? row.bidderId : listing.ownerId, listing));
        terms = { ownerItems: owner ? own : last.ownerItems, bidderItems: owner ? last.bidderItems : own, cashAdjustment: input.cashAdjustment };
        await validateExchange(tx, terms, listing, row.bidderId);
      } else if (input.priceIdr === undefined || input.exchangeItemIds || input.cashAdjustment !== undefined) throw new AppException(400, 'INVALID_INPUT', 'Counteroffer Resell memerlukan harga.');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const next = await tx.offerRevision.create({ data: { offerId: id, revisionNo: row.currentRevisionNo + 1, priceIdr: input.priceIdr === undefined ? null : BigInt(input.priceIdr), message: input.message ?? null, proposedById: userId, respondsById: previous.proposedById, expiresAt,
        clientRequestId: input.clientRequestId, requestHash: input.clientRequestId ? hash(input) : null,
        ...(terms ? { exchangeTerms: json(terms), items: { create: exchangeItems(terms).map(item => ({ itemId: item.id })) } } : {}) } });
      await tx.offer.update({ where: { id }, data: { status: 'COUNTERED', currentRevisionId: next.id, currentRevisionNo: { increment: 1 }, expiresAt, endReason: null, version: { increment: 1 },
        ...(terms ? { exchangeItemId: terms.bidderItems[0].id, exchangeSnapshot: json(terms.bidderItems[0]) } : {}) } });
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
      const ref = await tx.offer.findUnique({ where: { id }, include: { listing: true, currentRevision: true } });
      if (!ref) throw new AppException(404, 'NOT_FOUND', 'Penawaran tidak ditemukan.');
      await lockRows(tx, 'User', [ref.bidderId, ref.listing.ownerId]);
      const captured = ref.currentRevision?.exchangeTerms as unknown as ExchangeTerms | null;
      await lockRows(tx, 'Item', [ref.listing.itemId, ...(captured ? exchangeItems(captured).map(item => item.id) : ref.exchangeItemId ? [ref.exchangeItemId] : [])]);
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
