import { z } from 'zod';
import { uuidSchema } from './common.js';

const price = z.preprocess(value => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(0).max(Number.MAX_SAFE_INTEGER));
export const marketSorts = ['newest', 'price_asc', 'price_desc', 'score_desc'] as const;
export const marketSearchSchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  type: z.enum(['RESELL', 'EXCHANGE', 'DONATE']).optional(),
  cityId: uuidSchema.optional(),
  condition: z.enum(['EXCELLENT', 'GOOD', 'NEEDS_ATTENTION']).optional(),
  minPriceIdr: price.optional(), maxPriceIdr: price.optional(),
}).refine(v => v.minPriceIdr === undefined || v.maxPriceIdr === undefined || v.minPriceIdr <= v.maxPriceIdr, { message: 'Harga minimum tidak boleh melebihi maksimum.' })
  .refine(v => (v.minPriceIdr === undefined && v.maxPriceIdr === undefined) || !v.type || v.type === 'RESELL', { message: 'Filter harga berlaku untuk jual kembali.' });
export type MarketSearchFilters = z.infer<typeof marketSearchSchema>;
export const marketSearchQuerySchema = marketSearchSchema.safeExtend({ sort: z.enum(marketSorts).default('newest') })
  .refine(v => !v.sort.startsWith('price_') || v.type === 'RESELL', { message: 'Urutan harga memerlukan jenis jual kembali.' });
export type MarketSearchQuery = z.infer<typeof marketSearchQuerySchema>;
export const marketSearchKeys = ['q', 'category', 'type', 'cityId', 'condition', 'minPriceIdr', 'maxPriceIdr'] as const;

export function parseMarketSearch(params: URLSearchParams) {
  const values: Record<string, string> = {};
  for (const key of [...marketSearchKeys, 'sort']) {
    if (params.getAll(key).length > 1) return marketSearchQuerySchema.safeParse({ sort: 'INVALID' });
    const value = params.get(key)?.trim(); if (value) values[key] = value;
  }
  return marketSearchQuerySchema.safeParse(values);
}
export function marketSearchKey(filters: MarketSearchFilters) {
  return JSON.stringify(marketSearchKeys.flatMap(key => filters[key] === undefined ? [] : [[key, key === 'q' ? filters.q!.toLowerCase() : filters[key]]]));
}
export function marketSearchUrl(filters: MarketSearchFilters, sort: MarketSearchQuery['sort'] = 'newest') {
  const params = new URLSearchParams();
  for (const key of marketSearchKeys) if (filters[key] !== undefined) params.set(key, String(filters[key]));
  if (sort !== 'newest') params.set('sort', sort);
  return '/market' + (params.size ? '?' + params.toString() : '');
}
export const savedSearchCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filters: marketSearchSchema.refine(v => marketSearchKeys.some(key => v[key] !== undefined), { message: 'Gunakan kata kunci atau setidaknya satu filter.' }),
  sort: z.enum(marketSorts).default('newest'), alertsEnabled: z.boolean().default(true),
}).refine(v => !v.sort.startsWith('price_') || v.filters.type === 'RESELL', { message: 'Urutan harga memerlukan jenis jual kembali.' });
export const savedSearchUpdateSchema = z.object({ expectedVersion: z.number().int().positive(), name: z.string().trim().min(1).max(80).optional(), alertsEnabled: z.boolean().optional() })
  .refine(v => v.name !== undefined || v.alertsEnabled !== undefined, { message: 'Pilih pengaturan yang ingin diubah.' });
export type SavedSearchCreateInput = z.infer<typeof savedSearchCreateSchema>;
export type SavedSearchUpdateInput = z.infer<typeof savedSearchUpdateSchema>;
export interface SavedSearchDto { id: string; name: string; filters: MarketSearchFilters; sort: MarketSearchQuery['sort']; alertsEnabled: boolean; version: number; createdAt: string }
