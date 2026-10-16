import { z } from 'zod';
import { uuidSchema, versionActionSchema } from './common.js';
import type { ItemDto } from './items.js';
import type { TransactionItemSnapshot } from './transactions.js';

export const exchangeItemIdsSchema = z.array(uuidSchema).min(1).max(3).refine(ids => new Set(ids).size === ids.length, 'Pilih barang yang berbeda.');
export const cashAdjustmentSchema = z.object({ amountIdr: z.number().int().min(1).max(1_000_000_000_000), payer: z.enum(['OWNER', 'BIDDER']) }).strict();
export type CashAdjustment = z.infer<typeof cashAdjustmentSchema>;
export interface ExchangeTerms { ownerItems: TransactionItemSnapshot[]; bidderItems: TransactionItemSnapshot[]; cashAdjustment: CashAdjustment | null }
export interface ExchangeCandidateDto { item: ItemDto; eligible: boolean; reason: string | null }
export const cashConfirmationSchema = versionActionSchema.extend({ kind: z.enum(['SENT', 'RECEIVED']) }).strict();
export type CashConfirmationInput = z.infer<typeof cashConfirmationSchema>;
export interface CashConfirmationDto { id: string; actorId: string; kind: 'SENT' | 'RECEIVED'; confirmedAt: string; source: 'USER_REPORTED' }
