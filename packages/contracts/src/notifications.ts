import { z } from 'zod';

export const notificationReadSchema = z.object({ throughSequence: z.number().int().positive().optional() }).default({});

export const notificationTypes = ['OFFER_RECEIVED', 'OFFER_COUNTERED', 'OFFER_REJECTED', 'OFFER_WITHDRAWN', 'OFFER_EXPIRED', 'TRANSACTION_STARTED', 'HANDOVER_CONFIRMED', 'TRANSACTION_COMPLETED', 'CANCELLATION_REQUESTED', 'CANCELLATION_REJECTED', 'TRANSACTION_CANCELLED', 'DISPUTE_OPENED', 'DISPUTE_CONTINUED', 'HANDOVER_REMINDER', 'SAVED_SEARCH_MATCH', 'REVIEW_RECEIVED', 'REVIEW_REPLY_RECEIVED', 'MESSAGE_RECEIVED', 'HANDOVER_PROPOSED', 'HANDOVER_APPROVED', 'HANDOVER_REJECTED', 'HANDOVER_WITHDRAWN', 'HANDOVER_EXPIRED', 'SHIPMENT_UPDATED'] as const;
export type NotificationType = typeof notificationTypes[number];
export const notificationsQuerySchema = z.object({
  status: z.enum(['all', 'unread']).default('all'),
  category: z.enum(['all', 'offers', 'transactions', 'market', 'messages']).default('all'),
  cursor: z.string().min(1).max(400).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
export interface NotificationCenterDto {
  id: string;
  type: NotificationType;
  category: 'offers' | 'transactions' | 'market' | 'messages';
  title: string;
  message: string;
  itemTitle: string;
  target: { kind: 'OFFER' | 'TRANSACTION' | 'LISTING' | 'CONVERSATION'; id: string };
  latestMessageSequence?: number;
  createdAt: string;
  readAt: string | null;
}
export interface NotificationSummaryDto { unreadCount: number; recent: NotificationCenterDto[] }
