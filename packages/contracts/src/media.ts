import { z } from 'zod';
import { uuidSchema } from './common.js';

export const mediaTicketSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  bytes: z.number().int().min(1).max(8 * 1024 * 1024),
  purpose: z.enum(['ITEM', 'REPAIR_EVIDENCE', 'CASE_EVIDENCE', 'MESSAGE_ATTACHMENT', 'REPAIR_TUTORIAL']).default('ITEM'),
});

export const mediaFinalizeSchema = z.object({ ticketId: uuidSchema });

export type MediaTicketInput = z.infer<typeof mediaTicketSchema>;

export interface MediaDto { id: string; mime: string; bytes: number; orderIndex: number; processedAt: string }
