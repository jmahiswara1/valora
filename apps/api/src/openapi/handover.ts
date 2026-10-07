import { handoverProposalSchema, handoverResponseSchema, handoverWithdrawSchema, shipmentSchema } from '@valora/contracts';
import { object, uuid, text, date, integer, nullable, array, ref, bool } from './helpers.js';
import type { Route } from './types.js';
export const handoverInputs = { HandoverProposalInput: handoverProposalSchema, HandoverResponse: handoverResponseSchema, HandoverWithdraw: handoverWithdrawSchema, ShipmentInput: shipmentSchema };
export const handoverOutputs = {
  HandoverDestination: object({ recipientName: text, phone: text, address: text }),
  HandoverPrivate: object({ location: nullable(text), note: nullable(text), responseReason: nullable(text), destinations: array(object({ userId: uuid, details: ref('HandoverDestination') })) }),
  HandoverProposal: object({ id: uuid, transactionId: uuid, proposedById: uuid, method: { type: 'string', enum: ['MEETUP', 'DELIVERY'] }, plannedAt: date, timeZone: { type: 'string', enum: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'] }, status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'INVALIDATED'] }, endReason: nullable(text), privateDetails: nullable(ref('HandoverPrivate')), createdAt: date, respondedAt: nullable(date), respondedById: nullable(uuid), purgedAt: nullable(date) }),
  Shipment: object({ id: uuid, proposalId: uuid, itemId: uuid, senderId: uuid, courier: nullable(text), trackingNumber: nullable(text), reason: nullable(text), revision: integer, recordedAt: date, purgedAt: nullable(date) }),
  Handover: object({ transactionId: uuid, version: integer, deadlineAt: date, serverTime: date, agreed: nullable(ref('HandoverProposal')), pending: nullable(ref('HandoverProposal')), directions: array(object({ itemId: uuid, title: text, fromUserId: uuid, toUserId: uuid, received: bool, canRecord: bool, shipment: nullable(ref('Shipment')) })), permissions: object({ canPropose: bool, canRespond: bool, canWithdraw: bool, reason: nullable(text) }) }),
  HandoverMutation: object({ id: uuid, transactionId: uuid, version: integer, status: text }),
  TransactionTimeline: object({ id: text, type: text, actorId: nullable(uuid), label: text, occurredAt: date, proposalId: nullable(uuid), itemId: nullable(uuid) }),
  AdminHandover: object({ coordination: ref('Handover'), history: array(ref('HandoverProposal')), shipments: array(ref('Shipment')), accessExpiresAt: date, nextCursor: nullable(text), shipmentNextCursor: nullable(text) }),
};
export const handoverRoutes: Route[] = [
  { order: 190, method: 'get', path: '/transactions/{id}/handover', auth: true, output: ref('Handover') },
  { order: 191, method: 'get', path: '/transactions/{id}/handover/proposals/{proposalId}', auth: true, output: ref('HandoverProposal') },
  { order: 192, method: 'post', path: '/transactions/{id}/handover/proposals', auth: true, idempotent: true, input: 'HandoverProposalInput', output: ref('HandoverMutation') },
  { order: 193, method: 'post', path: '/transactions/{id}/handover/proposals/{proposalId}/respond', auth: true, idempotent: true, input: 'HandoverResponse', output: ref('HandoverMutation') },
  { order: 194, method: 'post', path: '/transactions/{id}/handover/proposals/{proposalId}/withdraw', auth: true, idempotent: true, input: 'HandoverWithdraw', output: ref('HandoverMutation') },
  { order: 195, method: 'post', path: '/transactions/{id}/handover/shipments/{itemId}', auth: true, idempotent: true, input: 'ShipmentInput', output: ref('HandoverMutation') },
  { order: 196, method: 'get', path: '/transactions/{id}/timeline', auth: true, output: array(ref('TransactionTimeline')), query: ['cursor', 'limit'] },
  { order: 197, method: 'post', path: '/admin/cases/{id}/handover-access', auth: true, idempotent: true, input: 'CaseAccessInput', output: object({ grantId: uuid, expiresAt: date }) },
  { order: 199, method: 'get', path: '/transactions/{id}/handover/proposals/{proposalId}/shipments', auth: true, output: array(ref('Shipment')), query: ['cursor', 'limit'] },
  { order: 198, method: 'get', path: '/admin/cases/{id}/handover', auth: true, output: ref('AdminHandover'), query: ['cursor', 'shipmentCursor', 'limit'] },
];
