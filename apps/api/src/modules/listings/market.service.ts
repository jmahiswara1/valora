import { AppException } from '../../shared/http.js';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { StorageService } from '../../infrastructure/storage.service.js';
import { uuidSchema, marketSearchQuerySchema, type PublicListingDto } from '@valora/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Response } from 'express';
import { type MarketFilters, listingInclude, revisionDto, activeListingDto } from './shared.js';

import { marketWhere } from './search.js';
import { decodeMarketCursor } from './market-cursor.js';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

const pageLimit = (value?: string) => {
  const limit = value === undefined ? 20 : Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new AppException(400, 'INVALID_INPUT', 'Limit harus antara 1 dan 50.');
  return limit;
};

@Injectable()
export class MarketService {
  constructor(private readonly db: DatabaseService, private readonly storage: StorageService) {}

  async list(filters: MarketFilters) {
    const parsed = marketSearchQuerySchema.safeParse(Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')));
    if (!parsed.success) throw new AppException(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Filter Market tidak valid.');
    const { sort } = parsed.data;
    const limit = pageLimit(filters.limit);
    const cursor = filters.cursor === undefined ? null : decodeMarketCursor(filters.cursor, sort);
    let where: Prisma.ListingWhereInput = marketWhere(parsed.data);
    if (cursor) {
      const at = new Date(cursor.createdAt);
      let cursorWhere: Prisma.ListingWhereInput;
      if (cursor.sort === 'newest') cursorWhere = { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: cursor.id } }] };
      else if (cursor.sort === 'price_asc' || cursor.sort === 'price_desc') {
        const price = BigInt(cursor.price);
        const priceComparison = cursor.sort === 'price_asc' ? { gt: price } : { lt: price };
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
    const data: PublicListingDto[] = page.flatMap((row) => row.currentRevision ? [{ id: row.id, type: row.type, status: 'ACTIVE' as const, version: row.version, owner: { id: row.ownerId, displayName: row.owner.displayName, city: { id: row.currentRevision.city.id, code: row.currentRevision.city.code, name: row.currentRevision.city.name, provinceName: row.currentRevision.city.provinceName } }, revision: revisionDto(row.currentRevision, row.id, true), publishedAt: row.publishedAt?.toISOString() ?? null }] : []);
    const last = page.at(-1);
    const nextCursor = rows.length > limit && last ? encode({ sort, id: last.id, createdAt: last.createdAt.toISOString(), ...(sort.startsWith('price_') ? { price: Number(last.currentRevision?.askingPriceIdr ?? 0n) } : {}), ...(sort === 'score_desc' ? { score: last.currentRevision?.score ?? null } : {}) }) : null;
    return { data, meta: { nextCursor } };
  }

  async getPublic(id: string): Promise<PublicListingDto> {
    if (!uuidSchema.safeParse(id).success) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
    const row = await this.db.listing.findUnique({ where: { id }, include: listingInclude });
    if (!row || !row.currentRevision || row.owner.status !== 'ACTIVE') throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
    if (row.status === 'RESERVED') return { id: row.id, type: row.type, status: 'RESERVED' };
    if (row.status !== 'ACTIVE') throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
    return activeListingDto(row);
  }

  async publicPhoto(listingId: string, mediaId: string, response: Response): Promise<void> {
    const link = await this.db.listingRevisionMedia.findFirst({ where: { mediaId, revision: { listingId, listing: { status: 'ACTIVE', owner: { status: 'ACTIVE' }, currentRevisionId: { not: null } } }, media: { deletedAt: null, repairRecordId: null, caseId: null } }, include: { revision: { include: { listing: true } }, media: true } });
    if (!link || link.revision.listing.currentRevisionId !== link.revisionId) throw new AppException(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
    const bytes = await this.storage.read(link.media.storageKey);
    response.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.send(bytes);
  }
}
