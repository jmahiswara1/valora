import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { uuidSchema, type FavoriteDto, type FavoriteStatusDto, type FavoritesQuery } from '@valora/contracts';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { AppException } from '../../shared/http.js';
import { serial, validId } from '../../shared/transactions.js';
import { listingInclude, activeListingDto } from '../listings/shared.js';

const cursorSchema = z.object({ createdAt: z.iso.datetime(), listingId: uuidSchema });
function decodeCursor(value?: string) {
  if (value === undefined) return null;
  try { return cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))); }
  catch { throw new AppException(400, 'INVALID_INPUT', 'Cursor Favorit tidak valid.'); }
}

@Injectable()
export class FavoritesService {
  constructor(private readonly db: DatabaseService) {}

  async list(userId: string, input: FavoritesQuery) {
    const cursor = decodeCursor(input.cursor);
    const rows = await this.db.favorite.findMany({
      where: { userId, ...(cursor ? { OR: [
        { createdAt: { lt: new Date(cursor.createdAt) } },
        { createdAt: new Date(cursor.createdAt), listingId: { lt: cursor.listingId } },
      ] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { listingId: 'desc' }], take: input.limit + 1,
      include: { listing: { include: listingInclude } },
    });
    const page = rows.slice(0, input.limit);
    const data: FavoriteDto[] = page.map(row => {
      const base = { listingId: row.listingId, savedAt: row.createdAt.toISOString(), savedTitle: row.savedTitle };
      if (row.listing.status === 'ACTIVE' && row.listing.currentRevision) return { ...base, availability: 'ACTIVE', listing: activeListingDto(row.listing) };
      return { ...base, availability: row.listing.status === 'RESERVED' ? 'RESERVED' : 'UNAVAILABLE', listing: null };
    });
    const last = page.at(-1);
    const nextCursor = rows.length > input.limit && last
      ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), listingId: last.listingId })).toString('base64url') : null;
    return { data, meta: { nextCursor } };
  }

  async status(userId: string, listingIds: string[]): Promise<FavoriteStatusDto[]> {
    const rows = await this.db.favorite.findMany({ where: { userId, listingId: { in: listingIds } }, select: { listingId: true } });
    const saved = new Set(rows.map(row => row.listingId));
    return listingIds.map(listingId => ({ listingId, isFavorite: saved.has(listingId) }));
  }

  async save(userId: string, listingId: string): Promise<FavoriteStatusDto> {
    validId(listingId);
    return serial(this.db, async tx => {
      const existing = await tx.favorite.findUnique({ where: { userId_listingId: { userId, listingId } } });
      if (!existing) {
        const listing = await tx.listing.findUnique({ where: { id: listingId }, include: { currentRevision: true } });
        if (!listing) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
        if (listing.status !== 'ACTIVE' || !listing.currentRevision) throw new AppException(409, 'STATE_CONFLICT', 'Barang tidak lagi tersedia untuk disimpan.');
        await tx.favorite.create({ data: { userId, listingId, savedTitle: listing.currentRevision.title } });
      }
      return { listingId, isFavorite: true };
    });
  }

  async remove(userId: string, listingId: string): Promise<FavoriteStatusDto> {
    validId(listingId);
    await serial(this.db, tx => tx.favorite.deleteMany({ where: { userId, listingId } }));
    return { listingId, isFavorite: false };
  }
}
