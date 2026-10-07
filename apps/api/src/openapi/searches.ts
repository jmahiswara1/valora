import { savedSearchCreateSchema, savedSearchUpdateSchema } from '@valora/contracts';
import { object, text, uuid, integer, date, bool, array, ref } from './helpers.js';
import type { Route } from './types.js';
export const searchesInputs = { SavedSearchCreate: savedSearchCreateSchema, SavedSearchUpdate: savedSearchUpdateSchema };
export const searchesOutputs = { SavedSearch: object({ id: uuid, name: text, filters: { type: 'object', properties: { q: text, category: text, type: { type: 'string', enum: ['RESELL', 'EXCHANGE', 'DONATE'] }, cityId: uuid, condition: { type: 'string', enum: ['EXCELLENT', 'GOOD', 'NEEDS_ATTENTION'] }, minPriceIdr: integer, maxPriceIdr: integer }, additionalProperties: false }, sort: { type: 'string', enum: ['newest', 'price_asc', 'price_desc', 'score_desc'] }, alertsEnabled: bool, version: integer, createdAt: date }) };
export const searchesRoutes: Route[] = [
  { order: 170, method: 'get', path: '/me/saved-searches', auth: true, output: array(ref('SavedSearch')) },
  { order: 171, method: 'post', path: '/me/saved-searches', auth: true, input: 'SavedSearchCreate', output: ref('SavedSearch') },
  { order: 172, method: 'patch', path: '/me/saved-searches/{id}', auth: true, input: 'SavedSearchUpdate', output: ref('SavedSearch') },
  { order: 173, method: 'delete', path: '/me/saved-searches/{id}', auth: true, output: object({ removed: bool }) },
];
