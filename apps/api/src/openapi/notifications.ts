import { notificationTypes, notificationReadSchema } from '@valora/contracts';
import { object, text, uuid, date, nullable, array, ref, bool, integer } from './helpers.js';
import type { Route } from './types.js';

export const notificationsInputs = { NotificationReadInput: notificationReadSchema };
export const notificationsOutputs = {
  NotificationCenter: object({ id: uuid, type: { type: 'string', enum: [...notificationTypes] }, category: { type: 'string', enum: ['offers', 'transactions', 'market', 'messages'] },
    title: text, message: text, itemTitle: text, target: object({ kind: { type: 'string', enum: ['OFFER', 'TRANSACTION', 'LISTING', 'CONVERSATION'] }, id: uuid }), latestMessageSequence: integer, createdAt: date, readAt: nullable(date) }, ['id', 'type', 'category', 'title', 'message', 'itemTitle', 'target', 'createdAt', 'readAt']),
  NotificationSummary: object({ unreadCount: integer, recent: array(ref('NotificationCenter')) }),
};
export const notificationsRoutes: Route[] = [
  { order: 160, method: 'get', path: '/me/notifications', auth: true, output: array(ref('NotificationCenter')), query: ['status', 'category', 'cursor', 'limit'] },
  { order: 161, method: 'get', path: '/me/notifications/summary', auth: true, output: ref('NotificationSummary') },
  { order: 162, method: 'post', path: '/me/notifications/read-all', auth: true, output: object({ read: bool, count: integer, readAt: date }) },
  { order: 163, method: 'post', path: '/me/notifications/{id}/read', auth: true, input: 'NotificationReadInput', output: object({ read: bool, readAt: nullable(date) }) },
];
