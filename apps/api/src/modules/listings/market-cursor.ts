import { z } from 'zod';
import { uuidSchema, type MarketSearchQuery } from '@valora/contracts';
import { AppException } from '../../shared/http.js';

const boundary = { id: uuidSchema, createdAt: z.iso.datetime().refine(value => Number.isFinite(Date.parse(value))) };
const marketCursorSchema = z.discriminatedUnion('sort', [
  z.object({ ...boundary, sort: z.literal('newest') }).strict(),
  z.object({ ...boundary, sort: z.literal('price_asc'), price: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict(),
  z.object({ ...boundary, sort: z.literal('price_desc'), price: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict(),
  z.object({ ...boundary, sort: z.literal('score_desc'), score: z.number().int().min(0).max(100).nullable() }).strict(),
]);

export function decodeMarketCursor(value: unknown, sort: MarketSearchQuery['sort']) {
  try {
    if (typeof value !== 'string' || value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid cursor encoding');
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.toString('base64url') !== value) throw new Error('Invalid cursor encoding');
    const cursor = marketCursorSchema.parse(JSON.parse(bytes.toString('utf8')));
    if (cursor.sort !== sort) throw new Error('Cursor sort differs');
    return cursor;
  } catch { throw new AppException(400, 'INVALID_INPUT', 'Cursor Market tidak valid.'); }
}
