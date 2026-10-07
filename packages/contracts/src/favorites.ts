import { z } from 'zod';
import { uuidSchema } from './common.js';
import type { PublicListingDto } from './listings.js';

export const favoritesQuerySchema = z.object({
  cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const favoriteStatusQuerySchema = z.object({
  listingIds: z.string().max(3700).transform(value => value.split(','))
    .pipe(z.array(uuidSchema).min(1).max(100))
    .refine(ids => new Set(ids).size === ids.length, 'Listing tidak boleh berulang.'),
});

export type FavoritesQuery = z.infer<typeof favoritesQuerySchema>;
export interface FavoriteStatusDto { listingId: string; isFavorite: boolean }
export type FavoriteDto = { listingId: string; savedAt: string; savedTitle: string } & (
  | { availability: 'ACTIVE'; listing: Extract<PublicListingDto, { status: 'ACTIVE' }> }
  | { availability: 'RESERVED' | 'UNAVAILABLE'; listing: null }
);
