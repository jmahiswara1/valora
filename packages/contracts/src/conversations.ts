import { z } from 'zod';
import { uuidSchema } from './common.js';

export const messageCreateSchema = z.object({
  clientMessageId: uuidSchema,
  body: z.string().trim().max(2000).default(''),
  ticketIds: z.array(uuidSchema).max(3).default([]),
}).refine(x => Boolean(x.body || x.ticketIds.length), { message: 'Tambahkan pesan atau foto.' })
  .refine(x => new Set(x.ticketIds).size === x.ticketIds.length, { message: 'Foto tidak boleh berulang.' });

export const conversationReadSchema = z.object({ throughSequence: z.number().int().min(0) });
export const messageStatusQuerySchema = z.object({ clientMessageId: uuidSchema });
export const messagePhotoScopeSchema = z.object({ scopeType: z.enum(['REPORT', 'DISPUTE', 'CORRECTION']).optional(), scopeId: uuidSchema.optional() })
  .refine(x => Boolean(x.scopeType) === Boolean(x.scopeId), { message: 'Lingkup foto tidak lengkap.' });
export type MessagePhotoScope = z.infer<typeof messagePhotoScopeSchema>;

export const conversationMessagesQuerySchema = z.object({ before: z.string().trim().max(100).optional(), limit: z.coerce.number().int().min(1).max(50).default(30) });

export const blockUserSchema = z.object({ userId: uuidSchema });

export type MessageCreateInput = z.infer<typeof messageCreateSchema>;

export interface MessageAttachmentDto { id: string; mime: string; bytes: number; width: number; height: number; orderIndex: number }
export interface MessageDto { id: string; conversationId: string; senderId: string; body: string; clientMessageId: string; sequence: number; attachments: MessageAttachmentDto[]; sentAt: string }

export interface ConversationDto { id: string; listingId: string; listingTitle: string; transactionId?: string | null; participant: { id: string; displayName: string; profilePhotoUrl: string | null }; lastMessage: MessageDto | null; unreadCount: number; readSequence: number; peerReadSequence: number; messageSequence: number; updatedAt: string }
