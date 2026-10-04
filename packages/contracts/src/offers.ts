import { z } from 'zod';
import { uuidSchema, versionActionSchema } from './common.js';
import type { TransactionItemSnapshot } from './transactions.js';
import { listingTypes } from './listings.js';

export const listingOfferSchema = z.object({ listingRevisionId: uuidSchema, expectedListingVersion: z.number().int().positive(), clientRequestId: uuidSchema, priceIdr: z.number().int().min(1).max(1_000_000_000_000).nullable().optional(), exchangeItemId: uuidSchema.nullable().optional(), message: z.string().trim().max(500).nullable().optional() });

export const offerCounterSchema = z.object({ expectedVersion: z.number().int().positive(), priceIdr: z.number().int().min(1).max(1_000_000_000_000), message: z.string().trim().max(500).nullable().optional() });

export const offerDecisionSchema = z.object({ expectedVersion: z.number().int().positive() });

export type ListingOfferInput = z.infer<typeof listingOfferSchema>;

export type OfferCounterInput = z.infer<typeof offerCounterSchema>;

export interface OfferRevisionDto { id: string; revisionNo: number; priceIdr: number | null; message: string | null; proposedById: string; respondsById: string; createdAt: string; expiresAt: string }

export interface OfferDto { id: string; listingId: string; listingRevisionId: string; bidderId: string; exchangeItemId: string | null; exchangeSnapshot: TransactionItemSnapshot | null; transactionId: string | null; status: 'PENDING' | 'COUNTERED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED'; endReason: string | null; expiresAt: string; version: number; currentRevision: OfferRevisionDto | null; createdAt: string; listing: { title: string; type: typeof listingTypes[number] } }

export const offerAcceptSchema = versionActionSchema.extend({ offerRevisionId: uuidSchema, listingRevisionId: uuidSchema });

export type OfferAcceptInput = z.infer<typeof offerAcceptSchema>;
