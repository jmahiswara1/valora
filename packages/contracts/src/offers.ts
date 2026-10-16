import { z } from 'zod';
import { uuidSchema, versionActionSchema } from './common.js';
import type { TransactionItemSnapshot } from './transactions.js';
import { listingTypes } from './listings.js';
import { exchangeItemIdsSchema, cashAdjustmentSchema, type ExchangeTerms } from './exchange.js';

export const listingOfferSchema = z.object({ listingRevisionId: uuidSchema, expectedListingVersion: z.number().int().positive(), clientRequestId: uuidSchema, priceIdr: z.number().int().min(1).max(1_000_000_000_000).nullable().optional(), exchangeItemId: uuidSchema.nullable().optional(), exchangeItemIds: exchangeItemIdsSchema.optional(), cashAdjustment: cashAdjustmentSchema.nullable().optional(), message: z.string().trim().max(500).nullable().optional() }).strict().refine(v => !(v.exchangeItemId && v.exchangeItemIds), 'Gunakan satu format daftar barang.');

export const offerCounterSchema = z.object({ expectedVersion: z.number().int().positive(), priceIdr: z.number().int().min(1).max(1_000_000_000_000).optional(), exchangeItemIds: exchangeItemIdsSchema.optional(), cashAdjustment: cashAdjustmentSchema.nullable().optional(), clientRequestId: uuidSchema.optional(), message: z.string().trim().max(500).nullable().optional() }).strict().refine(v => v.priceIdr !== undefined ? !v.exchangeItemIds && v.cashAdjustment === undefined : !!v.exchangeItemIds && v.cashAdjustment !== undefined && !!v.clientRequestId, 'Isi harga Resell atau paket Exchange, tambahan uang dan ID permintaan.');

export const offerDecisionSchema = z.object({ expectedVersion: z.number().int().positive() });

export type ListingOfferInput = z.infer<typeof listingOfferSchema>;

export type OfferCounterInput = z.infer<typeof offerCounterSchema>;

export interface OfferRevisionDto { id: string; revisionNo: number; priceIdr: number | null; message: string | null; proposedById: string; respondsById: string; createdAt: string; expiresAt: string; exchangeTerms?: ExchangeTerms | null; termsHash?: string | null }

export interface OfferDto { id: string; listingId: string; listingRevisionId: string; bidderId: string; exchangeItemId: string | null; exchangeSnapshot: TransactionItemSnapshot | null; transactionId: string | null; status: 'PENDING' | 'COUNTERED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED'; endReason: string | null; expiresAt: string; version: number; currentRevision: OfferRevisionDto | null; createdAt: string; listing: { title: string; type: typeof listingTypes[number] } }

export const offerAcceptSchema = versionActionSchema.extend({ offerRevisionId: uuidSchema, listingRevisionId: uuidSchema, exchangeTermsHash: z.string().regex(/^[a-f0-9]{64}$/).optional() });

export type OfferAcceptInput = z.infer<typeof offerAcceptSchema>;
