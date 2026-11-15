import { z } from 'zod';
import { versionActionSchema } from './common.js';

export const demoPaymentSchema = versionActionSchema.extend({ demoOnly: z.literal(true) }).strict();
export type DemoPaymentInput = z.infer<typeof demoPaymentSchema>;
export interface DemoPaymentDto {
  transactionId: string; mode: 'DEMO'; method: 'QRIS'; status: 'NOT_REQUIRED' | 'UNPAID' | 'PAID';
  amountIdr: number; payerId: string | null; receiverId: string | null; paidAt: string | null;
  reference: string | null; version: number; canSimulate: boolean; reason: string | null;
}
