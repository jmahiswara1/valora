import { messageCreateSchema, conversationMessagesQuerySchema, conversationReadSchema, messageStatusQuerySchema, messagePhotoScopeSchema, blockUserSchema } from '@valora/contracts';
import { object, uuid, text, date, nullable, ref, integer, array } from './helpers.js';
import type { Route } from './types.js';

export const conversationsInputs = {
MessageCreateInput: messageCreateSchema,
ConversationMessagesQuery: conversationMessagesQuerySchema,
ConversationReadInput: conversationReadSchema,
MessageStatusQuery: messageStatusQuerySchema,
MessagePhotoScopeQuery: messagePhotoScopeSchema,
BlockUserInput: blockUserSchema
};

export const conversationsOutputs = {
MessageAttachment: object({ id: uuid, mime: text, bytes: integer, width: integer, height: integer, orderIndex: integer }),
Message: object({ id: uuid, conversationId: uuid, senderId: uuid, body: text, clientMessageId: uuid, sequence: integer, attachments: array(ref('MessageAttachment')), sentAt: date }),
Conversation: object({ id: uuid, listingId: uuid, listingTitle: text, transactionId: nullable(uuid), participant: object({ id: uuid, displayName: text, profilePhotoUrl: nullable(text) }), lastMessage: nullable(ref('Message')), unreadCount: integer, readSequence: integer, peerReadSequence: integer, messageSequence: integer, updatedAt: date })
};

export const conversationsRoutes: Route[] = [
{ order: 135, method: 'post', path: '/listings/{listingId}/conversations', auth: true, output: ref('Conversation') },
{ order: 136, method: 'get', path: '/conversations', auth: true, output: array(ref('Conversation')) },
{ order: 137, method: 'get', path: '/conversations/unread-count', auth: true, output: ref('Count') },
{ order: 138, method: 'get', path: '/conversations/stream', auth: true, output: object({ type: text, data: object({ conversationId: uuid, sequence: integer }) }) },
{ order: 139, method: 'get', path: '/conversations/{id}/messages', auth: true, output: array(ref('Message')), query: ['before', 'limit'] },
{ order: 140, method: 'post', path: '/conversations/{id}/messages', auth: true, input: 'MessageCreateInput', output: ref('Message') },
{ order: 141, method: 'post', path: '/conversations/{id}/read', auth: true, input: 'ConversationReadInput', output: object({ readSequence: integer, unreadCount: integer }) },
{ order: 141.1, method: 'get', path: '/conversations/{id}', auth: true, output: ref('Conversation') },
{ order: 141.2, method: 'get', path: '/conversations/{id}/messages/status', auth: true, query: ['clientMessageId'], output: object({ committed: { type: 'boolean' }, message: nullable(ref('Message')) }) },
{ order: 141.3, method: 'post', path: '/conversations/{id}/photos/tickets', auth: true, input: 'MediaTicketInput', output: object({ ticketId: uuid, uploadUrl: text, expiresAt: date }) },
{ order: 141.4, method: 'get', path: '/message-photos/{id}/access', auth: true, query: ['scopeType', 'scopeId'], output: object({ url: text, expiresAt: date }) },
{ order: 141.5, method: 'get', path: '/message-photos/private/{id}', auth: true, query: ['expires', 'signature', 'scopeType', 'scopeId'], binary: true, output: { type: 'string', format: 'binary' } },
{ order: 142, method: 'post', path: '/blocks', auth: true, input: 'BlockUserInput', output: object({ blocked: { type: 'boolean' } }) },
{ order: 143, method: 'delete', path: '/blocks/{userId}', auth: true, output: object({ blocked: { type: 'boolean' } }) }
];
