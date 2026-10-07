import { ref, object, array, text, date, uuid, bool, nullable } from './helpers.js';
import type { Route } from './types.js';

export const favoritesInputs = {};
export const favoritesOutputs = {
  FavoriteStatus: object({ listingId: uuid, isFavorite: bool }),
  Favorite: object({ listingId: uuid, savedAt: date, savedTitle: text,
    availability: { type: 'string', enum: ['ACTIVE', 'RESERVED', 'UNAVAILABLE'] }, listing: nullable(ref('PublicListing')) }),
};
export const favoritesRoutes: Route[] = [
  { order: 150, method: 'get', path: '/me/favorites', auth: true, output: array(ref('Favorite')), query: ['cursor', 'limit'] },
  { order: 151, method: 'get', path: '/me/favorites/status', auth: true, output: array(ref('FavoriteStatus')), query: ['listingIds'] },
  { order: 152, method: 'put', path: '/me/favorites/{listingId}', auth: true, output: ref('FavoriteStatus') },
  { order: 153, method: 'delete', path: '/me/favorites/{listingId}', auth: true, output: ref('FavoriteStatus') },
];
