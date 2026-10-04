import { mediaTicketSchema, mediaFinalizeSchema } from '@valora/contracts';
import { object, uuid, text, integer, date, ticket, ref } from './helpers.js';
import type { Route } from './types.js';

export const mediaInputs = {
MediaTicketInput: mediaTicketSchema,
MediaFinalizeInput: mediaFinalizeSchema
};

export const mediaOutputs = {
Media: object({ id: uuid, mime: text, bytes: integer, orderIndex: integer, processedAt: date })
};

export const mediaRoutes: Route[] = [
{ order: 101, method: 'post', path: '/items/{id}/media/tickets', auth: true, input: 'MediaTicketInput', output: ticket },
{ order: 102, method: 'post', path: '/items/{id}/media/finalize', auth: true, input: 'MediaFinalizeInput', output: ref('Item') },
{ order: 103, method: 'delete', path: '/items/{id}/media/{mediaId}', auth: true, output: ref('Item') },
{ order: 111, method: 'post', path: '/media/tickets', auth: true, input: 'MediaTicketInput', output: ticket },
{ order: 112, method: 'put', path: '/media/uploads/{ticketId}', auth: true, binary: true, output: object({ ticketId: uuid, mime: text, bytes: integer }) },
{ order: 113, method: 'get', path: '/media/{mediaId}/access', auth: true, output: object({ url: text, expiresAt: date }) },
{ order: 114, method: 'get', path: '/media/private/{mediaId}', auth: true, output: { type: 'string', format: 'binary' }, binary: true }
];
