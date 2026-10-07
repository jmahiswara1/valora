import { z } from 'zod';
import { uuidSchema } from './common.js';
import type { MediaDto } from './media.js';
import type { CityDto } from './catalog.js';

export const listingTypes = ['RESELL', 'EXCHANGE', 'DONATE'] as const;

export const listingStatuses = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'RESERVED', 'CLOSED', 'REJECTED', 'WITHDRAWN', 'SUSPENDED'] as const;

export const handoverMethods = ['MEETUP', 'DELIVERY'] as const;

const listingCommon = {
  assessmentId: uuidSchema,
  expectedItemVersion: z.number().int().positive(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(3000),
  mediaIds: z.array(uuidSchema).min(1).max(8),
  cityId: uuidSchema,
  conditionDisclosure: z.string().trim().min(3).max(1500),
  handoverMethods: z.array(z.enum(handoverMethods)).min(1).max(2),
};

export const listingSaveSchema = z.discriminatedUnion('type', [
  z.object({ ...listingCommon, type: z.literal('RESELL'), askingPriceIdr: z.number().int().min(1).max(1_000_000_000_000), exchangePreference: z.null().optional(), recipientNote: z.null().optional() }),
  z.object({ ...listingCommon, type: z.literal('EXCHANGE'), askingPriceIdr: z.null().optional(), exchangePreference: z.string().trim().min(3).max(1000), recipientNote: z.null().optional() }),
  z.object({ ...listingCommon, type: z.literal('DONATE'), askingPriceIdr: z.null().optional(), exchangePreference: z.null().optional(), recipientNote: z.string().trim().max(500).nullable().optional() }),
]).refine((value) => new Set(value.mediaIds).size === value.mediaIds.length, { message: 'Foto Listing tidak boleh berulang', path: ['mediaIds'] }).refine((value) => new Set(value.handoverMethods).size === value.handoverMethods.length, { message: 'Metode serah terima tidak boleh berulang', path: ['handoverMethods'] });

export const listingPatchSchema = z.discriminatedUnion('type', [
  z.object({ ...listingCommon, type: z.literal('RESELL'), askingPriceIdr: z.number().int().min(1).max(1_000_000_000_000), exchangePreference: z.null().optional(), recipientNote: z.null().optional(), expectedVersion: z.number().int().positive(), copyOnlyCorrection: z.boolean().default(false) }),
  z.object({ ...listingCommon, type: z.literal('EXCHANGE'), askingPriceIdr: z.null().optional(), exchangePreference: z.string().trim().min(3).max(1000), recipientNote: z.null().optional(), expectedVersion: z.number().int().positive(), copyOnlyCorrection: z.boolean().default(false) }),
  z.object({ ...listingCommon, type: z.literal('DONATE'), askingPriceIdr: z.null().optional(), exchangePreference: z.null().optional(), recipientNote: z.string().trim().max(500).nullable().optional(), expectedVersion: z.number().int().positive(), copyOnlyCorrection: z.boolean().default(false) }),
]).refine((value) => new Set(value.mediaIds).size === value.mediaIds.length, { message: 'Foto Listing tidak boleh berulang', path: ['mediaIds'] }).refine((value) => new Set(value.handoverMethods).size === value.handoverMethods.length, { message: 'Metode serah terima tidak boleh berulang', path: ['handoverMethods'] });

export const moderationDecisionSchema = z.object({ expectedVersion: z.number().int().positive(), decision: z.enum(['APPROVE', 'REQUEST_CHANGES', 'REJECT']), reasonCode: z.string().trim().min(2).max(60), reasonText: z.string().trim().min(5).max(1000), riskFlags: z.array(z.string().trim().min(2).max(80)).max(20).default([]) });

export const listingAdminActionSchema = z.object({ reportId: uuidSchema, expectedVersion: z.number().int().positive(), reason: z.string().trim().min(5).max(1000) });

export const listingAdminReleaseSchema = listingAdminActionSchema.extend({ withdraw: z.boolean().default(false) });

export type ListingSaveInput = z.infer<typeof listingSaveSchema>;

export type ListingPatchInput = z.infer<typeof listingPatchSchema>;

export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;

export type ListingAdminActionInput = z.infer<typeof listingAdminActionSchema>;

export type ListingAdminReleaseInput = z.infer<typeof listingAdminReleaseSchema>;

export interface ListingDto { id: string; itemId: string; type: typeof listingTypes[number]; status: typeof listingStatuses[number]; version: number; currentRevision: ListingRevisionDto | null; createdAt: string; updatedAt: string }

export interface ListingRevisionDto { id: string; itemId: string; revisionNo: number; assessmentId: string; itemRevision: number; title: string; description: string; categoryCode: string; categoryName: string; subcategoryCode: string | null; media: (MediaDto & { url?: string })[]; city: CityDto; condition: number; score: number | null; scoreLabel: string | null; ruleVersion: string; conditionDisclosure: string; askingPriceIdr: number | null; exchangePreference: string | null; recipientNote: string | null; handoverMethods: typeof handoverMethods[number][]; createdAt: string }

export type PublicListingDto = { id: string; type: typeof listingTypes[number]; status: 'ACTIVE'; version: number; owner: { id: string; displayName: string; city: CityDto }; revision: ListingRevisionDto; publishedAt: string | null } | { id: string; type: typeof listingTypes[number]; status: 'RESERVED' };

export interface ModerationQueueDto { revisionId: string; listingId: string; listingType: typeof listingTypes[number]; title: string; ownerName: string; cityName: string; specialReview: boolean; riskFlags: string[]; submittedAt: string; revisionNo: number; version: number }

export interface ModerationDetailDto { revisionId: string; listingId: string; listingVersion: number; listingType: typeof listingTypes[number]; ownerName: string; cityName: string; specialReview: boolean; riskFlags: string[]; submittedAt: string; revision: ListingRevisionDto }
