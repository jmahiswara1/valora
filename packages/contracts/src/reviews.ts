import { z } from 'zod';
import { uuidSchema } from './common.js';
import type { CityDto } from './catalog.js';

export const reviewCreateSchema = z.object({ expectedTransactionVersion: z.number().int().positive(), rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() });
export const reviewReplySchema = z.object({ expectedReviewVersion: z.number().int().positive(), body: z.string().trim().min(1).max(1000) });
export const reviewVisibilitySchema = z.object({ reportId: uuidSchema, expectedVersion: z.number().int().positive(), visibility: z.enum(['VISIBLE', 'HIDDEN']), reason: z.string().trim().min(5).max(1000) });
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type ReviewReplyInput = z.infer<typeof reviewReplySchema>;
export type ReviewVisibilityInput = z.infer<typeof reviewVisibilitySchema>;
export interface PublicPersonDto { id: string; displayName: string; profilePhotoUrl: string | null }
export interface RatingSummaryDto { average: number | null; count: number }
export interface PublicProfileDto extends PublicPersonDto { city: CityDto | null; joinedAt: string; rating: RatingSummaryDto }
export interface ReviewDto { id: string; author: PublicPersonDto; subjectId: string; rating: number; comment: string | null; type: 'RESELL' | 'EXCHANGE' | 'DONATE'; createdAt: string; version: number; visibility: 'VISIBLE' | 'HIDDEN'; reply: { id: string; body: string | null; createdAt: string; version: number; visibility: 'VISIBLE' | 'HIDDEN' } | null }
export interface TransactionReviewsDto { transactionVersion: number; eligibility: { canReview: boolean; reason: string | null; deadlineAt: string | null; target: PublicPersonDto | null }; reviews: ReviewDto[] }
