import { z } from 'zod';
import { uuidSchema } from './common.js';

export const indicatorKeys = ['function', 'physical', 'completeness', 'repairMethod', 'repairSupport', 'reuse'] as const;

export const levelCodes = ['LEVEL_0', 'LEVEL_25', 'LEVEL_50', 'LEVEL_75', 'LEVEL_100'] as const;

export const safetyAnswers = ['TIDAK', 'YA', 'TIDAK_TAHU'] as const;

export const economicSourceSchema = z.object({
  referenceId: uuidSchema.optional(),
  amountIdr: z.number().int().min(0).max(1_000_000_000_000),
  sourceType: z.enum(['USER_REFERENCE', 'USER_ESTIMATE', 'ADMIN_CATEGORY_REFERENCE']),
  sourceNote: z.string().trim().min(3).max(500),
  referenceDate: z.iso.date(),
});

export const assessmentCreateSchema = z.object({
  expectedItemRevision: z.number().int().positive(),
  rubricVersionId: uuidSchema,
  answers: z.partialRecord(z.enum(indicatorKeys), z.enum(levelCodes)),
  safetyAnswers: z.record(z.string().min(1), z.enum(safetyAnswers)),
  contextAnswer: z.string().trim().max(500).optional(),
  hasIssue: z.boolean().nullable(),
  repairNeeded: z.boolean().nullable(),
  economic: z.object({
    estimatedResaleValue: economicSourceSchema.optional(),
    estimatedRepairCost: economicSourceSchema.optional(),
    comparableReplacementPrice: economicSourceSchema.optional(),
  }),
}).refine((value) => !(value.hasIssue === false && value.repairNeeded === true), { message: 'Tidak dapat memerlukan perbaikan bila tidak ada masalah', path: ['repairNeeded'] });

export type IndicatorKey = typeof indicatorKeys[number];

export type LevelCode = typeof levelCodes[number];

export type AssessmentCreateInput = z.infer<typeof assessmentCreateSchema>;

export interface RubricQuestion { key: IndicatorKey; prompt: string; choices: { code: LevelCode; label: string; value: number }[] }

export interface SafetyQuestion { code: string; prompt: string; effectOnYes: 'PROHIBITED' | 'SPECIAL_REVIEW' | 'DISCLOSE' }

export interface RubricDto { id: string; rubricKey: string; ruleVersion: string; policyVersion: string; recommendationVersion: string; effectiveAt: string; questions: RubricQuestion[]; safetyQuestions: SafetyQuestion[]; contextPrompt: string | null }

export interface ActionRecommendation { action: 'REPAIR' | 'RESELL' | 'EXCHANGE' | 'DONATE'; status: 'ELIGIBLE' | 'NEEDS_DATA' | 'INELIGIBLE'; reasons: string[] }

export interface AssessmentDto { id: string; itemId: string; itemRevision: number; rubricVersionId: string; ruleVersion: string; policyVersion: string; recommendationVersion: string; rubric: RubricDto; status: 'INCOMPLETE' | 'PARTIAL_ECONOMIC' | 'COMPLETE'; condition: number | null; repairability: number | null; repairabilityReason: 'NOT_NEEDED' | null; economicValue: number | null; reusePotential: number | null; score: number | null; label: string | null; missingFields: string[]; safetyFlags: string[]; recommendations: ActionRecommendation[]; answers: AssessmentCreateInput | null; economicSources: Record<string, z.infer<typeof economicSourceSchema> & { reportedBy: string }> | null; createdAt: string; isCurrent: boolean; origin: 'USER_REPORTED' }

export const explanationSchema = z.object({ source: z.literal('TEMPLATE'), templateVersion: z.string(), assessmentId: uuidSchema, historical: z.boolean(), summary: z.string().max(800), strengths: z.array(z.string().max(500)), limitations: z.array(z.string().max(500)), actions: z.array(z.object({ action: z.enum(['REPAIR', 'RESELL', 'EXCHANGE', 'DONATE']), status: z.enum(['ELIGIBLE', 'NEEDS_DATA', 'INELIGIBLE']), reasons: z.array(z.string().max(500)) })), nextSteps: z.array(z.string().max(500)) });

export type ExplanationDto = z.infer<typeof explanationSchema>;
