import type { MarketSearchFilters } from '@valora/contracts';
import type { Prisma } from '../../generated/prisma/client.js';

// Both the public catalog and saved-search alerts match the same public revision.
export function marketWhere(filters: MarketSearchFilters): Prisma.ListingWhereInput {
  return { status: 'ACTIVE', ...(filters.type ? { type: filters.type } : {}), currentRevision: { is: {
    ...(filters.category ? { categoryCode: filters.category } : {}), ...(filters.cityId ? { cityId: filters.cityId } : {}),
    ...(filters.minPriceIdr !== undefined || filters.maxPriceIdr !== undefined ? { askingPriceIdr: {
      ...(filters.minPriceIdr !== undefined ? { gte: BigInt(filters.minPriceIdr) } : {}), ...(filters.maxPriceIdr !== undefined ? { lte: BigInt(filters.maxPriceIdr) } : {}),
    } } : {}),
    ...(filters.condition === 'EXCELLENT' ? { condition: { gte: 75 } } : filters.condition === 'GOOD' ? { condition: { gte: 50, lt: 75 } } : filters.condition === 'NEEDS_ATTENTION' ? { condition: { lt: 50 } } : {}),
    ...(filters.q ? { OR: [{ title: { contains: filters.q, mode: 'insensitive' } }, { description: { contains: filters.q, mode: 'insensitive' } }, { category: { name: { contains: filters.q, mode: 'insensitive' } } }, { city: { name: { contains: filters.q, mode: 'insensitive' } } }] } : {}),
  } } };
}
