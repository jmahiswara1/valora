import { messageCreateSchema, conversationMessagesQuerySchema, blockUserSchema } from '@valora/contracts';
import { object, uuid, text, date, nullable, ref, integer, array } from './helpers.js';
import type { Route } from './types.js';

export const conversationsInputs = {
MessageCreateInput: messageCreateSchema,
ConversationMessagesQuery: conversationMessagesQuerySchema,
BlockUserInput: blockUserSchema
};

export const conversationsOutputs = {
Message: object({ id: uuid, conversationId: uuid, senderId: uuid, body: text, clientMessageId: uuid, sentAt: date }),
Conversation: object({ id: uuid, listingId: uuid, listingTitle: text, transactionId: nullable(uuid), participant: object({ id: uuid, displayName: text, profilePhotoUrl: nullable(text) }), lastMessage: nullable(ref('Message')), unreadCount: integer, updatedAt: date })
};

export const conversationsRoutes: Route[] = [
{ order: 135, method: 'post', path: '/listings/{listingId}/conversations', auth: true, output: ref('Conversation') },
{ order: 136, method: 'get', path: '/conversations', auth: true, output: array(ref('Conversation')) },
{ order: 137, method: 'get', path: '/conversations/unread-count', auth: true, output: ref('Count') },
{ order: 138, method: 'get', path: '/conversations/stream', auth: true, output: object({ type: text, data: object({ conversationId: uuid, sequence: integer }) }) },
{ order: 139, method: 'get', path: '/conversations/{id}/messages', auth: true, output: array(ref('Message')), query: ['before', 'limit'] },
{ order: 140, method: 'post', path: '/conversations/{id}/messages', auth: true, input: 'MessageCreateInput', output: ref('Message') },
{ order: 141, method: 'post', path: '/conversations/{id}/read', auth: true, output: ref('Count') },
{ order: 142, method: 'post', path: '/blocks', auth: true, input: 'BlockUserInput', output: object({ blocked: { type: 'boolean' } }) },
{ order: 143, method: 'delete', path: '/blocks/{userId}', auth: true, output: object({ blocked: { type: 'boolean' } }) }
];
