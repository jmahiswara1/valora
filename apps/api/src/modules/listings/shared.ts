import type { Prisma } from '../../generated/prisma/client.js';
import type { ListingRevisionDto } from '@valora/contracts';

export const revisionInclude = { city: true, category: true, media: { include: { media: true }, orderBy: { orderIndex: 'asc' as const } } } satisfies Prisma.ListingRevisionInclude;

export const listingInclude = { item: true, owner: { include: { city: true } }, currentRevision: { include: revisionInclude } } satisfies Prisma.ListingInclude;

type RevisionRow = Prisma.ListingRevisionGetPayload<{ include: typeof revisionInclude }>;

export const safetyFlags = (assessment: { safetyFlags: Prisma.JsonValue }) => assessment.safetyFlags as string[];

export const recommendations = (assessment: { recommendationSnapshot: Prisma.JsonValue }) => assessment.recommendationSnapshot as { action: string; status: string; reasons: string[] }[];

export function revisionDto(row: RevisionRow, listingId: string, publicMedia = false): ListingRevisionDto {
  return {
    id: row.id, itemId: row.itemId, revisionNo: row.revisionNo, assessmentId: row.assessmentId, itemRevision: row.itemRevision,
    title: row.title, description: row.description, categoryCode: row.categoryCode, categoryName: row.category.name,
    subcategoryCode: row.subcategoryCode,
    media: row.media.filter((entry) => !entry.media.deletedAt).map((entry) => ({
      id: entry.media.id, mime: entry.media.mime, bytes: entry.media.bytes, orderIndex: entry.orderIndex,
      processedAt: entry.media.processedAt.toISOString(), ...(publicMedia ? { url: `/api/v1/market/${listingId}/media/${entry.media.id}` } : {}),
    })),
    city: { id: row.city.id, code: row.city.code, name: row.city.name, provinceName: row.city.provinceName },
    condition: row.condition, score: row.score, scoreLabel: row.scoreLabel, ruleVersion: row.ruleVersion,
    conditionDisclosure: row.conditionDisclosure, askingPriceIdr: row.askingPriceIdr === null ? null : Number(row.askingPriceIdr),
    exchangePreference: row.exchangePreference, recipientNote: row.recipientNote,
    handoverMethods: row.handoverMethods as ListingRevisionDto['handoverMethods'], createdAt: row.createdAt.toISOString(),
  };
}

export type MarketFilters = { q?: string; category?: string; type?: string; cityId?: string; condition?: string; minPriceIdr?: string; maxPriceIdr?: string; sort?: string; cursor?: string; limit?: string };
