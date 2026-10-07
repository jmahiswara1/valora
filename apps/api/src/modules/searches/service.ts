import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { marketSearchSchema, marketSearchKey, marketSorts, type SavedSearchDto, type SavedSearchCreateInput, type SavedSearchUpdateInput } from '@valora/contracts';
import type { SavedSearch } from '../../generated/prisma/client.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { serial, validId, json } from '../../shared/transactions.js';
import { AppException } from '../../shared/http.js';
import { marketWhere } from '../listings/search.js';
import { notify } from '../notifications/events.js';

function dto(row: SavedSearch): SavedSearchDto {
  return { id: row.id, name: row.name, filters: marketSearchSchema.parse(row.filters), sort: marketSorts.find(v => v === row.sort) ?? 'newest', alertsEnabled: row.alertsEnabled, version: row.version, createdAt: row.createdAt.toISOString() };
}
@Injectable()
export class SearchesService {
  constructor(private readonly db: DatabaseService) {}
  async list(userId: string) { return (await this.db.savedSearch.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })).map(dto); }
  async create(userId: string, input: SavedSearchCreateInput) {
    const fingerprint = createHash('sha256').update(marketSearchKey(input.filters)).digest('hex');
    return serial(this.db, async tx => {
      const existing = await tx.savedSearch.findUnique({ where: { userId_fingerprint: { userId, fingerprint } } });
      if (existing) return dto(existing);
      if (await tx.savedSearch.count({ where: { userId } }) >= 10) throw new AppException(409, 'SAVED_SEARCH_LIMIT', 'Maksimum 10 pencarian tersimpan. Hapus salah satu untuk menyimpan pencarian baru.');
      if (input.filters.category && !await tx.category.findFirst({ where: { code: input.filters.category, active: true, parentCode: null } })) throw new AppException(400, 'INVALID_INPUT', 'Kategori pencarian tidak tersedia.');
      if (input.filters.cityId && !await tx.city.findFirst({ where: { id: input.filters.cityId, active: true } })) throw new AppException(400, 'INVALID_INPUT', 'Kota pencarian tidak tersedia.');
      const watermark = (await tx.searchPublication.aggregate({ _max: { sequence: true } }))._max.sequence ?? 0;
      const now = new Date();
      return dto(await tx.savedSearch.create({ data: { userId, fingerprint, name: input.name, filters: json(input.filters), sort: input.sort, alertsEnabled: input.alertsEnabled, alertsSince: now, createdAt: now, alertsAfterPublication: watermark } }));
    });
  }
  async update(userId: string, id: string, input: SavedSearchUpdateInput) {
    validId(id);
    return serial(this.db, async tx => {
      const row = await tx.savedSearch.findFirst({ where: { id, userId } });
      if (!row) throw new AppException(404, 'NOT_FOUND', 'Pencarian tidak ditemukan.');
      if (row.version !== input.expectedVersion) throw new AppException(409, 'STATE_CONFLICT', 'Pencarian telah berubah. Muat ulang sebelum melanjutkan.');
      const watermark = input.alertsEnabled && !row.alertsEnabled ? (await tx.searchPublication.aggregate({ _max: { sequence: true } }))._max.sequence ?? 0 : undefined;
      return dto(await tx.savedSearch.update({ where: { id }, data: { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.alertsEnabled !== undefined ? { alertsEnabled: input.alertsEnabled } : {}), ...(watermark !== undefined ? { alertsSince: new Date(), alertsAfterPublication: watermark } : {}), version: { increment: 1 } } }));
    });
  }
  async remove(userId: string, id: string) {
    validId(id);
    await serial(this.db, tx => tx.savedSearch.deleteMany({ where: { id, userId } }));
    return { removed: true };
  }
  async processBatch() {
    // A persisted cursor and atomic checkpoint keep restart/retry safe. The gate
    // also orders this batch against closure, toggles and publication changes.
    return serial(this.db, async tx => {
      const job = await tx.searchPublication.findFirst({ where: { processedAt: null }, orderBy: { sequence: 'asc' }, include: { listing: { include: { currentRevision: true } } } });
      if (!job) return false;
      const listing = job.listing;
      if (listing.status !== 'ACTIVE' || listing.currentRevisionId !== job.revisionId || listing.publishedAt?.getTime() !== job.publishedAt.getTime()) {
        await tx.searchPublication.update({ where: { listingId: job.listingId }, data: { processedAt: new Date() } }); return true;
      }
      const searches = await tx.savedSearch.findMany({ where: { alertsEnabled: true, alertsAfterPublication: { lt: job.sequence }, user: { status: 'ACTIVE' }, userId: { not: listing.ownerId }, ...(job.afterSearchId ? { id: { gt: job.afterSearchId } } : {}) }, orderBy: { id: 'asc' }, take: 100 });
      for (const search of searches) {
        const matches = await tx.listing.count({ where: { AND: [{ id: listing.id }, marketWhere(marketSearchSchema.parse(search.filters))] } });
        if (matches) await notify(tx, 'SAVED_SEARCH_MATCH', `saved-search-match:${listing.id}`, [search.userId], { listingId: listing.id, title: listing.currentRevision!.title });
      }
      await tx.searchPublication.update({ where: { listingId: job.listingId }, data: { afterSearchId: searches.at(-1)?.id ?? job.afterSearchId, ...(searches.length < 100 ? { processedAt: new Date() } : {}) } });
      return true;
    });
  }
}
