import { z } from 'zod';
import { uuidSchema } from './common.js';

export const messageCreateSchema = z.object({ clientMessageId: uuidSchema, body: z.string().trim().min(1).max(2000) });

export const conversationMessagesQuerySchema = z.object({ before: z.string().trim().max(100).optional(), limit: z.coerce.number().int().min(1).max(50).default(30) });

export const blockUserSchema = z.object({ userId: uuidSchema });

export type MessageCreateInput = z.infer<typeof messageCreateSchema>;

export interface MessageDto { id: string; conversationId: string; senderId: string; body: string; clientMessageId: string; sentAt: string }

export interface ConversationDto { id: string; listingId: string; listingTitle: string; transactionId?: string | null; participant: { id: string; displayName: string; profilePhotoUrl: string | null }; lastMessage: MessageDto | null; unreadCount: number; updatedAt: string }
