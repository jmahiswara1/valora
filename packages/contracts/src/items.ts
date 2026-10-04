import { z } from 'zod';
import { uuidSchema } from './common.js';
import type { MediaDto } from './media.js';

const itemFields = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(3000),
  categoryCode: z.string().trim().min(2).max(50),
  subcategoryCode: z.string().trim().min(2).max(50).nullable().optional(),
  functionSummary: z.string().trim().max(1500).nullable().optional(),
  conditionSummary: z.string().trim().max(1500).nullable().optional(),
  completenessSummary: z.string().trim().max(1500).nullable().optional(),
  issueSummary: z.string().trim().max(1500).nullable().optional(),
  purchaseYear: z.number().int().min(1900).max(new Date().getUTCFullYear()).nullable().optional(),
  originalPriceIdr: z.number().int().min(0).max(1000000000000).nullable().optional(),
  estimatedWeightGrams: z.number().int().positive().max(1000000000).nullable().optional(),
});

export const itemCreateSchema = itemFields.extend({ uploadTicketIds: z.array(uuidSchema).min(1).max(8) });

export const itemPatchSchema = itemFields.partial().extend({ expectedVersion: z.number().int().positive() }).refine((value) => Object.keys(value).some((key) => key !== 'expectedVersion'));

export type ItemCreateInput = z.infer<typeof itemCreateSchema>;

export type ItemPatchInput = z.infer<typeof itemPatchSchema>;

export interface ItemDto {
  id: string; title: string; description: string; categoryCode: string; subcategoryCode: string | null;
  functionSummary: string | null; conditionSummary: string | null; completenessSummary: string | null; issueSummary: string | null;
  purchaseYear: number | null; originalPriceIdr: number | null; estimatedWeightGrams: number | null;
  reservedByTransactionId: string | null;
  itemRevision: number; version: number; createdAt: string; updatedAt: string; media: MediaDto[];
}
