import { z } from 'zod';
import { uuidSchema } from './common.js';
import type { MediaDto } from './media.js';

const repairFieldsSchema = z.object({
  expectedItemVersion: z.number().int().positive(),
  performedAt: z.iso.datetime(),
  actionSummary: z.string().trim().min(5).max(1500),
  privateNotes: z.string().trim().max(3000).nullable().optional(),
  costIdr: z.number().int().min(0).max(1_000_000_000_000).nullable().optional(),
  costKind: z.enum(['ACTUAL', 'ESTIMATE']).nullable().optional(),
  outcome: z.enum(['SUCCEEDED', 'UNSUCCESSFUL']),
  afterCondition: z.string().trim().min(3).max(1500),
  shareSummaryPublic: z.boolean().default(false),
  shareDetailsWithFutureOwner: z.boolean().default(false),
  evidenceTicketIds: z.array(uuidSchema).max(4).default([]),
});

export const repairCreateSchema = repairFieldsSchema.refine((value) => (value.costIdr == null) === (value.costKind == null), { message: 'Jenis biaya wajib bila nominal diisi', path: ['costKind'] });

export const repairCorrectionSchema = repairFieldsSchema.omit({ expectedItemVersion: true, evidenceTicketIds: true }).partial().extend({ expectedVersion: z.number().int().positive(), reason: z.string().trim().min(5).max(500) });

export const repairVoidSchema = z.object({ expectedVersion: z.number().int().positive(), reason: z.string().trim().min(5).max(500) });

export type RepairCreateInput = z.infer<typeof repairCreateSchema>;

export type RepairCorrectionInput = z.infer<typeof repairCorrectionSchema>;

export type RepairVoidInput = z.infer<typeof repairVoidSchema>;

export interface RepairDto { id: string; itemId: string; createdById?: string; performedAt: string; actionSummary: string; privateNotes?: string | null; costIdr?: number | null; costKind?: 'ACTUAL' | 'ESTIMATE' | null; outcome: 'SUCCEEDED' | 'UNSUCCESSFUL'; afterCondition: string; status: 'VALID' | 'VOID'; shareSummaryPublic: boolean; shareDetailsWithFutureOwner?: boolean; evidence: MediaDto[]; voidReason?: string | null; version: number; createdAt: string; origin: 'USER_REPORTED' }
