import { z } from 'zod';
import { versionActionSchema, uuidSchema } from './common.js';
import { listingTypes } from './listings.js';
import type { DisputeDto } from './disputes.js';
import type { CorrectionCaseDto } from './operations.js';
import type { CashAdjustment, CashConfirmationDto } from './exchange.js';

export const transactionStatuses = ['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED', 'DISPUTED', 'CANCELLED', 'COMPLETED'] as const;

export const confirmationSchema = versionActionSchema.extend({ itemId: uuidSchema, kind: z.enum(['HANDED_OVER', 'RECEIVED']) });

export const cancellationSchema = versionActionSchema.extend({ reason: z.string().trim().min(5).max(1000) });

export const cancellationResponseSchema = versionActionSchema.extend({ accept: z.boolean() });

export type ConfirmationInput = z.infer<typeof confirmationSchema>;

export interface TransactionItemSnapshot { id: string; itemRevision: number; assessmentId: string; title: string; description: string; conditionSummary: string | null; categoryCode: string; subcategoryCode: string | null; estimatedWeightGrams: number | null; mediaIds: string[]; fromUserId: string; toUserId: string }

export interface TransactionSnapshot { listingRevisionId: string; offerRevisionId: string; items: TransactionItemSnapshot[]; parties: { id: string; displayName: string }[]; handoverMethods: string[]; cashAdjustment?: CashAdjustment | null }

export interface ConfirmationDto { id: string; actorId: string; itemId: string; kind: 'HANDED_OVER' | 'RECEIVED'; confirmedAt: string; source: string }

export interface CancellationDto { id: string; requestedById: string; reason: string; status: string; endReason: string | null; createdAt: string; respondedAt: string | null }

export interface TransactionDto { id: string; listingId: string; offerId: string; type: typeof listingTypes[number]; status: typeof transactionStatuses[number]; sellerOrDonorId: string; buyerOrRecipientId: string; finalPriceIdr: number | null; snapshot: TransactionSnapshot; acceptedAt: string; targetHandoverAt: string; overdueAt: string | null; completedAt: string | null; cancelledAt: string | null; resolutionOrigin: string | null; correctedAt: string | null; version: number; confirmations: ConfirmationDto[]; cashConfirmations?: CashConfirmationDto[]; cancellations: CancellationDto[]; disputes: DisputeDto[]; corrections: CorrectionCaseDto[]; conversationId: string | null; requiredConfirmations: { actorId: string; itemId: string; kind: 'HANDED_OVER' | 'RECEIVED' }[] }

export interface NotificationDto { id: string; type: string; payload: { transactionId: string; title: string; day?: number }; createdAt: string; readAt: string | null }
