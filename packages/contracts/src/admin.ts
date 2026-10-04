import { z } from 'zod';
import { uuidSchema, versionReasonSchema } from './common.js';
import { indicatorKeys, levelCodes } from './assessments.js';

export const economicReferenceCreateSchema = z.object({ categoryCode: z.string().min(2).max(50), field: z.enum(['estimatedResaleValue', 'estimatedRepairCost', 'comparableReplacementPrice']), amountIdr: z.number().int().min(0).max(1_000_000_000_000), sourceNote: z.string().trim().min(5).max(350), referenceDate: z.iso.date(), region: z.string().trim().min(2).max(120), reason: z.string().trim().min(5).max(1000) });

export const rubricDraftSchema = z.object({ baseVersionId: uuidSchema, reason: z.string().trim().min(5).max(1000) });

export const rubricDraftUpdateSchema = versionReasonSchema.extend({ questions: z.array(z.object({ key: z.enum(indicatorKeys), prompt: z.string().trim().min(5).max(500), choices: z.array(z.object({ code: z.enum(levelCodes), label: z.string().trim().min(2).max(500), value: z.number().int() })).length(5) })).length(6), safetyQuestions: z.array(z.object({ code: z.string().regex(/^[a-z0-9_]{2,60}$/), prompt: z.string().trim().min(5).max(500), effectOnYes: z.enum(['PROHIBITED', 'SPECIAL_REVIEW', 'DISCLOSE']) })).min(1).max(20), contextPrompt: z.string().trim().min(5).max(500).nullable() });
