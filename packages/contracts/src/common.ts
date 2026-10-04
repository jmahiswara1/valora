import { z } from 'zod';

export const uuidSchema = z.uuid();

export const versionActionSchema = z.object({ expectedVersion: z.number().int().positive() });

// Stage 5 operations share explicit version and reason contracts.
export const versionReasonSchema = z.object({ expectedVersion: z.number().int().positive(), reason: z.string().trim().min(5).max(1000) });

export const accessReasonSchema = z.object({ reason: z.string().trim().min(5).max(1000) });

export interface ApiError { error: { code: string; message: string; details?: unknown; requestId: string } }

export interface ApiSuccess<T> { data: T; meta?: { nextCursor?: string | null; accessExpiresAt?: string } }

export const listPageSchema = z.object({ cursor: z.string().max(300).optional(), limit: z.coerce.number().int().min(1).max(50).default(20), status: z.string().max(30).optional() });
