import { z } from 'zod';
import { uuidSchema, versionReasonSchema } from './common.js';

export const reportCreateSchema = z.object({ targetType: z.enum(['LISTING', 'MESSAGE', 'USER', 'TRANSACTION']), targetId: uuidSchema, reasonCode: z.string().trim().min(2).max(60), details: z.string().trim().min(5).max(1000) });

export const reportReviewSchema = z.object({ expectedVersion: z.number().int().positive(), decision: z.enum(['RESOLVED', 'DISMISSED']), reason: z.string().trim().min(5).max(1000) });

export const correctionOpenSchema = versionReasonSchema;

export const correctionEvidenceSchema = z.object({ expectedVersion: z.number().int().positive(), note: z.string().trim().min(5).max(3000), messageId: uuidSchema.optional(), ticketIds: z.array(uuidSchema).max(4).default([]) });

export const ownershipCorrectionSchema = versionReasonSchema.extend({ caseId: uuidSchema, expectedCaseVersion: z.number().int().positive() });

export const impactCorrectionSchema = versionReasonSchema.extend({ caseId: uuidSchema, metric: z.enum(['ESTIMATED_TRANSFER_WEIGHT', 'CONFIRMED_SALE_VALUE']), itemId: uuidSchema.optional(), value: z.string().regex(/^\d{1,13}$/) });

export const sourceCorrectionSchema = versionReasonSchema.extend({ caseId: uuidSchema, valid: z.boolean() });

export const passportRestrictionSchema = versionReasonSchema.extend({ scopeType: z.enum(['REPORT', 'DISPUTE', 'CORRECTION']), caseId: uuidSchema, visibility: z.enum(['PUBLIC', 'LIMITED', 'HIDDEN']) });

export const retentionHoldSchema = z.object({ scopeType: z.enum(['REPORT', 'DISPUTE', 'CORRECTION']), scopeId: uuidSchema, reason: z.string().trim().min(5).max(1000), reviewAt: z.iso.datetime() });

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;

export interface CorrectionCaseDto { id: string; transactionId: string; status: string; assignedAdminId: string | null; version: number; resolution: string | null; createdAt: string; resolvedAt: string | null }
