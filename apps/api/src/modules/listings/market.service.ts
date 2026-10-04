import { AppException } from '../../shared/http.js';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { StorageService } from '../../infrastructure/storage.service.js';
import { uuidSchema, type PublicListingDto } from '@valora/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Response } from 'express';
import { type MarketFilters, listingInclude, revisionDto } from './shared.js';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

const decode = <T>(value: string): T => {
  try { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T; }
  catch { throw new AppException(400, 'INVALID_INPUT', 'Cursor Market tidak valid.'); }
};

const pageLimit = (value?: string) => {
  const limit = value === undefined ? 20 : Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new AppException(400, 'INVALID_INPUT', 'Limit harus antara 1 dan 50.');
  return limit;
};

type MarketCursor = { sort: string; id: string; createdAt: string; price?: number; score?: number | null };

@Injectable()
export class MarketService {
  constructor(private readonly db: DatabaseService, private readonly storage: StorageService) {}

  async list(filters: MarketFilters) {
    const q = filters.q?.trim().slice(0, 100);
    const sort = filters.sort ?? 'newest';
    if (!['newest', 'price_asc', 'price_desc', 'score_desc'].includes(sort)) throw new AppException(400, 'INVALID_INPUT', 'Urutan Market tidak dikenal.');
    if ((sort === 'price_asc' || sort === 'price_desc') && filters.type !== 'RESELL') throw new AppException(400, 'INVALID_INPUT', 'Urutan harga hanya tersedia untuk Resell.');
    if (filters.type && !['RESELL', 'EXCHANGE', 'DONATE'].includes(filters.type)) throw new AppException(400, 'INVALID_INPUT', 'Jenis Listing tidak dikenal.');
    if (filters.condition && !['EXCELLENT', 'GOOD', 'NEEDS_ATTENTION'].includes(filters.condition)) throw new AppException(400, 'INVALID_INPUT', 'Filter kondisi tidak dikenal.');
    const limit = pageLimit(filters.limit);
    const min = filters.minPriceIdr === undefined ? undefined : Number(filters.minPriceIdr);
    const max = filters.maxPriceIdr === undefined ? undefined : Number(filters.maxPriceIdr);
    if ((min !== undefined && (!Number.isSafeInteger(min) || min < 0)) || (max !== undefined && (!Number.isSafeInteger(max) || max < 0)) || (min !== undefined && max !== undefined && min > max)) throw new AppException(400, 'INVALID_INPUT', 'Rentang harga tidak valid.');
    if ((min !== undefined || max !== undefined) && filters.type && filters.type !== 'RESELL') throw new AppException(400, 'INVALID_INPUT', 'Filter harga hanya berlaku untuk Resell.');
    const cursor = filters.cursor ? decode<MarketCursor>(filters.cursor) : null;
    if (cursor && (cursor.sort !== sort || !uuidSchema.safeParse(cursor.id).success || Number.isNaN(Date.parse(cursor.createdAt)))) throw new AppException(400, 'INVALID_INPUT', 'Cursor tidak sesuai dengan urutan Market.');
    let where: Prisma.ListingWhereInput = {
      status: 'ACTIVE', ...(filters.type ? { type: filters.type as 'RESELL' | 'EXCHANGE' | 'DONATE' } : {}),
      currentRevision: {
        is: {
          ...(filters.category ? { categoryCode: filters.category } : {}), ...(filters.cityId ? { cityId: filters.cityId } : {}),
          ...(min !== undefined || max !== undefined ? { askingPriceIdr: { ...(min !== undefined ? { gte: BigInt(min) } : {}), ...(max !== undefined ? { lte: BigInt(max) } : {}) } } : {}),
          ...(filters.condition === 'EXCELLENT' ? { condition: { gte: 75 } } : filters.condition === 'GOOD' ? { condition: { gte: 50, lt: 75 } } : filters.condition === 'NEEDS_ATTENTION' ? { condition: { lt: 50 } } : {}),
          ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }, { category: { name: { contains: q, mode: 'insensitive' } } }, { city: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
        },
      },
    };
    if (cursor) {
      const at = new Date(cursor.createdAt);
      let cursorWhere: Prisma.ListingWhereInput;
      if (sort === 'newest') cursorWhere = { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: cursor.id } }] };
      else if (sort === 'price_asc' || sort === 'price_desc') {
        const price = BigInt(cursor.price ?? 0);
        const priceComparison = sort === 'price_asc' ? { gt: price } : { lt: price };
        cursorWhere = { OR: [
          { currentRevision: { is: { askingPriceIdr: priceComparison } } },
          { currentRevision: { is: { askingPriceIdr: price } }, createdAt: { lt: at } },
          { currentRevision: { is: { askingPriceIdr: price } }, createdAt: at, id: { lt: cursor.id } },
        ] };
      } else if (cursor.score === null) cursorWhere = { OR: [{ currentRevision: { is: { score: null } }, createdAt: { lt: at } }, { currentRevision: { is: { score: null } }, createdAt: at, id: { lt: cursor.id } }] };
      else cursorWhere = { OR: [{ currentRevision: { is: { score: { lt: cursor.score } } } }, { currentRevision: { is: { score: cursor.score } }, createdAt: { lt: at } }, { currentRevision: { is: { score: cursor.score } }, createdAt: at, id: { lt: cursor.id } }, { currentRevision: { is: { score: null } } }] };
      where = { AND: [where, cursorWhere] };
    }
    const orderBy: Prisma.ListingOrderByWithRelationInput[] = sort === 'price_asc' ? [{ currentRevision: { askingPriceIdr: 'asc' } }, { createdAt: 'desc' }, { id: 'desc' }]
      : sort === 'price_desc' ? [{ currentRevision: { askingPriceIdr: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }]
        : sort === 'score_desc' ? [{ currentRevision: { score: { sort: 'desc', nulls: 'last' } } }, { createdAt: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }];
    const rows = await this.db.listing.findMany({ where, orderBy, take: limit + 1, include: listingInclude });
    const page = rows.slice(0, limit);
    const data: PublicListingDto[] = page.flatMap((row) => row.currentRevision ? [{ id: row.id, type: row.type, status: 'ACTIVE' as const, version: row.version, owner: { displayName: row.owner.displayName, city: { id: row.currentRevision.city.id, code: row.currentRevision.city.code, name: row.currentRevision.city.name, provinceName: row.currentRevision.city.provinceName } }, revision: revisionDto(row.currentRevision, row.id, true), publishedAt: row.publishedAt?.toISOString() ?? null }] : []);
    const last = page.at(-1);
    const nextCursor = rows.length > limit && last ? encode({ sort, id: last.id, createdAt: last.createdAt.toISOString(), ...(sort.startsWith('price_') ? { price: Number(last.currentRevision?.askingPriceIdr ?? 0n) } : {}), ...(sort === 'score_desc' ? { score: last.currentRevision?.score ?? null } : {}) }) : null;
    return { data, meta: { nextCursor } };
  }

  async getPublic(id: string): Promise<PublicListingDto> {
    if (!uuidSchema.safeParse(id).success) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
    const row = await this.db.listing.findUnique({ where: { id }, include: listingInclude });
    if (!row || !row.currentRevision) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
    if (row.status === 'RESERVED') return { id: row.id, type: row.type, status: 'RESERVED' };
    if (row.status !== 'ACTIVE') throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
    return { id: row.id, type: row.type, status: 'ACTIVE', version: row.version, owner: { displayName: row.owner.displayName, city: { id: row.currentRevision.city.id, code: row.currentRevision.city.code, name: row.currentRevision.city.name, provinceName: row.currentRevision.city.provinceName } }, revision: revisionDto(row.currentRevision, row.id, true), publishedAt: row.publishedAt?.toISOString() ?? null };
  }

  async publicPhoto(listingId: string, mediaId: string, response: Response): Promise<void> {
    const link = await this.db.listingRevisionMedia.findFirst({ where: { mediaId, revision: { listingId, listing: { status: 'ACTIVE', currentRevisionId: { not: null } } }, media: { deletedAt: null, repairRecordId: null, caseId: null } }, include: { revision: { include: { listing: true } }, media: true } });
    if (!link || link.revision.listing.currentRevisionId !== link.revisionId) throw new AppException(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
    const bytes = await this.storage.read(link.media.storageKey);
    response.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.send(bytes);
  }
}
