import { z } from 'zod';
import { uuidSchema } from './common.js';
import type { RepairCreateInput } from './repairs.js';
import { repairCreateSchema } from './repairs.js';

export const tutorialStates = ['PREFLIGHT', 'IN_PROGRESS', 'PAUSED', 'BLOCKED', 'REVIEW', 'RECORDED', 'STOPPED', 'INVALIDATED'] as const;
export type TutorialState = typeof tutorialStates[number];
export type ActivityKind = 'REPAIR' | 'MAINTENANCE';
export interface GuideBlock { id: string; text: string }
export interface GuideStep { id: string; title: string; instruction: string; simple: string; expected: string; stop: string[]; illustration?: { src: string; alt: string; caption: string }; alternatives: GuideBlock[]; faq: GuideBlock[] }
export interface RepairGuide { id: string; version: number; hash: string; title: string; goal: string; categoryCodes: string[]; subcategoryCodes: string[]; activityKind: ActivityKind; scope: string; exclusions: string[]; preparation: { id: string; question: string; requiredAnswer: 'YES' | 'NO' }[]; tools: string[]; steps: GuideStep[]; sources: { title: string; url: string; reviewedAt: string }[] }
export const tutorialCreateSchema = z.object({ guideId: z.string().min(1).max(80), guideVersion: z.number().int().positive(), expectedItemVersion: z.number().int().positive(), problem: z.string().trim().max(1500).default('') });
const version = { expectedVersion: z.number().int().positive() };
export const tutorialActionSchema = z.discriminatedUnion('action', [
  z.object({ ...version, action: z.literal('PREPARE'), answers: z.record(z.string().max(80), z.enum(['YES', 'NO', 'UNKNOWN'])) }),
  z.object({ ...version, action: z.literal('START'), expectedItemVersion: z.number().int().positive(), impactHash: z.string().length(64) }),
  z.object({ ...version, action: z.literal('STEP_DONE'), stepId: z.string().max(80) }),
  z.object({ ...version, action: z.literal('UNDO'), stepId: z.string().max(80) }),
  z.object({ ...version, action: z.enum(['PAUSE', 'RESUME', 'REVIEW']) }),
  z.object({ ...version, action: z.literal('STOP'), performedActions: z.boolean() }),
  z.object({ ...version, action: z.literal('SAVE_DRAFT'), record: repairCreateSchema, photoIds: z.array(uuidSchema).max(4).default([]) }),
  z.object({ ...version, action: z.literal('CLOSE'), afterCondition: z.string().trim().min(3).max(1500) }),
]);
export const tutorialQuestionSchema = z.object({ requestId: uuidSchema, ...version, stepId: z.string().max(80), question: z.string().trim().min(3).max(1000), photoIds: z.array(uuidSchema).max(3).default([]) });
export const tutorialPhotoTicketSchema = z.object({ stepId: z.string().max(80), fileName: z.string().trim().min(1).max(180), mime: z.enum(['image/jpeg', 'image/png', 'image/webp']), bytes: z.number().int().positive().max(8 * 1024 * 1024) });
export const tutorialPhotoFinalizeSchema = z.object({ ticketId: uuidSchema, stepId: z.string().max(80) });
export const tutorialRecordSchema = z.object({ ...version, record: repairCreateSchema, photoIds: z.array(uuidSchema).max(4).default([]) });
export type TutorialCreateInput = z.infer<typeof tutorialCreateSchema>;
export type TutorialActionInput = z.infer<typeof tutorialActionSchema>;
export type TutorialQuestionInput = z.infer<typeof tutorialQuestionSchema>;
export type TutorialRecordInput = z.infer<typeof tutorialRecordSchema>;
export type TutorialPhotoTicketInput = z.infer<typeof tutorialPhotoTicketSchema>;
export type TutorialPhotoFinalizeInput = z.infer<typeof tutorialPhotoFinalizeSchema>;
export interface TutorialReply { source: 'AI' | 'CATALOG' | 'UNAVAILABLE'; intent: 'EXPLAIN' | 'ALTERNATIVE' | 'CLARIFY' | 'OUT_OF_SCOPE' | 'STOP'; blocks: GuideBlock[]; observations: string[]; questions: string[]; reason?: string }
export interface TutorialInteractionDto { id: string; requestId: string; stepId: string; question: string; photoIds: string[]; status: 'PENDING' | 'ANSWERED' | 'UNAVAILABLE' | 'STALE'; reply: TutorialReply | null; createdAt: string }
export interface TutorialPhotoDto { id: string; stepId: string; bytes: number; width: number; height: number; createdAt: string }
export interface TutorialSessionDto { draft: RepairCreateInput | null; draftPhotoIds: string[]; id: string; itemId: string; itemTitle: string; itemVersion: number | null; itemCondition: string | null; guide: RepairGuide; state: TutorialState; reason: string | null; problem: string; answers: Record<string, 'YES' | 'NO' | 'UNKNOWN'>; completedSteps: string[]; performedActions: string[]; version: number; startedAt: string | null; closedAt: string | null; createdAt: string; purgedAt: string | null; recordId: string | null; photos: TutorialPhotoDto[]; capabilities: { canStart: boolean; canContinue: boolean; canAsk: boolean; canRecord: boolean; canClose: boolean } }
export interface TutorialStartPreview { sessionId: string; expectedVersion: number; expectedItemVersion: number; impactHash: string; listings: { id: string; title: string; status: string; version: number }[]; relatedOfferCount: number }
export interface TutorialAvailability { enabled: boolean; itemVersion: number; guides: RepairGuide[]; unclosedSessionId: string | null }
export interface TutorialMutationResult { id: string; version: number; recordId?: string }
