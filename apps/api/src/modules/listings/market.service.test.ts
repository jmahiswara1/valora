import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { MarketSearchQuery } from '@valora/contracts';
import type { DatabaseService } from '../../infrastructure/database.service.js';
import type { StorageService } from '../../infrastructure/storage.service.js';
import { AppException } from '../../shared/http.js';
import { MarketService } from './market.service.js';
import type { MarketFilters } from './shared.js';

const boundary = { id: randomUUID(), createdAt: '2026-11-02T08:00:00.000Z' };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
function fixture() {
  const findMany = vi.fn().mockResolvedValue([]);
  return { findMany, service: new MarketService({ listing: { findMany } } as unknown as DatabaseService, {} as StorageService) };
}
function filters(sort: MarketSearchQuery['sort'], cursor: unknown): MarketFilters {
  return { sort, ...(sort.startsWith('price_') ? { type: 'RESELL' } : {}), cursor } as MarketFilters;
}

describe('Market cursor validation', () => {
  const invalid: [string, MarketSearchQuery['sort'], unknown][] = [
    ['empty token', 'newest', ''], ['non-string token', 'newest', [encode({ ...boundary, sort: 'newest' })]],
    ['null token', 'newest', null], ['oversized token', 'newest', 'a'.repeat(1025)],
    ['invalid alphabet', 'newest', '!invalid'], ['invalid base64 length', 'newest', 'a'],
    ['broken JSON', 'newest', Buffer.from('{').toString('base64url')],
    ['null JSON', 'newest', encode(null)], ['array JSON', 'newest', encode([])],
    ['primitive JSON', 'newest', encode('cursor')],
    ['missing sort', 'newest', encode(boundary)],
    ['sort mismatch', 'newest', encode({ ...boundary, sort: 'price_asc', price: 10 })],
    ['invalid UUID', 'newest', encode({ ...boundary, sort: 'newest', id: 'not-a-uuid' })],
    ['missing timestamp', 'newest', encode({ id: boundary.id, sort: 'newest' })],
    ['invalid timestamp type', 'newest', encode({ ...boundary, sort: 'newest', createdAt: {} })],
    ['invalid date', 'newest', encode({ ...boundary, sort: 'newest', createdAt: '2026-02-30T00:00:00.000Z' })],
    ['unexpected field', 'newest', encode({ ...boundary, sort: 'newest', price: 0 })],
    ['missing price', 'price_asc', encode({ ...boundary, sort: 'price_asc' })],
    ['non-numeric price', 'price_asc', encode({ ...boundary, sort: 'price_asc', price: 'invalid-price' })],
    ['coerced price', 'price_desc', encode({ ...boundary, sort: 'price_desc', price: '1000' })],
    ['null price', 'price_desc', encode({ ...boundary, sort: 'price_desc', price: null })],
    ['negative price', 'price_asc', encode({ ...boundary, sort: 'price_asc', price: -1 })],
    ['fractional price', 'price_desc', encode({ ...boundary, sort: 'price_desc', price: 1.5 })],
    ['unsafe price', 'price_asc', encode({ ...boundary, sort: 'price_asc', price: Number.MAX_SAFE_INTEGER + 1 })],
    ['non-finite price', 'price_asc', Buffer.from(JSON.stringify({ ...boundary, sort: 'price_asc', price: 1 }).replace('"price":1', '"price":1e999')).toString('base64url')],
    ['missing score', 'score_desc', encode({ ...boundary, sort: 'score_desc' })],
    ['non-numeric score', 'score_desc', encode({ ...boundary, sort: 'score_desc', score: '75' })],
    ['negative score', 'score_desc', encode({ ...boundary, sort: 'score_desc', score: -1 })],
    ['excessive score', 'score_desc', encode({ ...boundary, sort: 'score_desc', score: 101 })],
    ['fractional score', 'score_desc', encode({ ...boundary, sort: 'score_desc', score: 75.5 })],
  ];
  it.each(invalid)('rejects %s before querying the database', async (_name, sort, cursor) => {
    const f = fixture(); const error = await f.service.list(filters(sort, cursor)).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(AppException);
    if (!(error instanceof AppException)) throw new Error('Expected input validation error');
    expect(error.getStatus()).toBe(400); expect(error.code).toBe('INVALID_INPUT'); expect(f.findMany).not.toHaveBeenCalled();
  });

  it.each([
    { sort: 'newest' as const, ...boundary },
    { sort: 'price_asc' as const, ...boundary, price: 0 },
    { sort: 'price_desc' as const, ...boundary, price: Number.MAX_SAFE_INTEGER },
    { sort: 'score_desc' as const, ...boundary, score: 0 },
    { sort: 'score_desc' as const, ...boundary, score: 100 },
    { sort: 'score_desc' as const, ...boundary, score: null },
  ])('accepts a valid boundary: $sort ($price / $score)', async cursor => {
    const f = fixture();
    await expect(f.service.list(filters(cursor.sort, encode(cursor)))).resolves.toEqual({ data: [], meta: { nextCursor: null } });
    expect(f.findMany).toHaveBeenCalledOnce();
  });
});
