import { z } from 'zod';
import { cancellationSchema } from './transactions.js';
import { uuidSchema, versionActionSchema } from './common.js';
import { mediaTicketSchema, type MediaDto } from './media.js';

export const disputeSchema = cancellationSchema;

export const evidenceSchema = z.object({ note: z.string().trim().min(1).max(3000).optional(), messageId: uuidSchema.optional(), ticketIds: z.array(uuidSchema).max(4).default([]) }).refine((x) => Boolean(x.note || x.messageId || x.ticketIds.length), { message: 'Tambahkan catatan, pesan, atau foto bukti.' }).refine((x) => new Set(x.ticketIds).size === x.ticketIds.length, { message: 'Foto bukti tidak boleh berulang.' });

export const caseAccessSchema = z.object({ reason: z.string().trim().min(5).max(1000) });

export const caseClaimSchema = versionActionSchema;

export const resolveDisputeSchema = versionActionSchema.extend({ caseId: uuidSchema, decision: z.enum(['CONTINUE', 'CANCEL', 'COMPLETE_AUTHORIZED']), reason: z.string().trim().min(5).max(1000), evidenceIds: z.array(uuidSchema).min(1).max(50) });

export const caseMediaTicketSchema = mediaTicketSchema.extend({ purpose: z.literal('CASE_EVIDENCE').default('CASE_EVIDENCE') });

export type EvidenceInput = z.infer<typeof evidenceSchema>;

export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

export interface DisputeDto { id: string; transactionId: string; status: string; assignedAdminId: string | null; reason?: string; resolution: string | null; resolutionReason?: string | null; version: number; createdAt: string; resolvedAt: string | null; transactionVersion?: number; transactionTitle?: string; overdueAt?: string | null }

export interface EvidenceDto { id: string; caseId: string; submittedById: string; note: string | null; message: { id: string; senderId: string; body: string; sentAt: string } | null; media: MediaDto[]; createdAt: string }
