import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import type { PublicProfileDto } from '@valora/contracts';
import { AppException } from '../../shared/http.js';
import { serial, validId } from '../../shared/transactions.js';
import { personSelect, publicPerson, publicReviewWhere, reviewInclude, reviewDto, reviewCursor, reviewPage } from '../reviews/shared.js';
import { listingInclude, activeListingDto } from '../listings/shared.js';
import type { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class PublicProfilesService {
  constructor(private readonly db: DatabaseService) {}
  private async available(tx: Prisma.TransactionClient, id: string) {
    validId(id);
    const row = await tx.user.findFirst({ where: { id, status: 'ACTIVE' }, select: { ...personSelect, city: true, createdAt: true } });
    if (!row) throw new AppException(404, 'NOT_FOUND', 'Profil tidak tersedia.');
    return row;
  }
  async get(id: string): Promise<PublicProfileDto> {
    return serial(this.db, async tx => {
      const row = await this.available(tx, id), summary = await tx.review.aggregate({ where: { ...publicReviewWhere(), subjectId: id }, _avg: { rating: true }, _count: true });
      return { ...publicPerson(row), city: row.city ? { id: row.city.id, code: row.city.code, name: row.city.name, provinceName: row.city.provinceName } : null,
        joinedAt: row.createdAt.toISOString(), rating: { average: summary._avg.rating === null ? null : Math.round(summary._avg.rating * 10) / 10, count: summary._count } };
    });
  }
  async reviews(id: string, cursor?: string) {
    const boundary = reviewCursor(cursor);
    return serial(this.db, async tx => {
      await this.available(tx, id);
      const rows = await tx.review.findMany({ where: { ...publicReviewWhere(), subjectId: id, ...(boundary ? { OR: [{ createdAt: { lt: boundary.at } }, { createdAt: boundary.at, id: { lt: boundary.id } }] } : {}) }, include: reviewInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21 });
      return reviewPage(rows, r => reviewDto(r));
    });
  }
  async listings(id: string, cursor?: string) {
    const boundary = reviewCursor(cursor);
    return serial(this.db, async tx => {
      await this.available(tx, id);
      const rows = await tx.listing.findMany({ where: { ownerId: id, status: 'ACTIVE', currentRevisionId: { not: null }, ...(boundary ? { OR: [{ createdAt: { lt: boundary.at } }, { createdAt: boundary.at, id: { lt: boundary.id } }] } : {}) }, include: listingInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21 });
      return reviewPage(rows, activeListingDto);
    });
  }
}
