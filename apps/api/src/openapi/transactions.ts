import { confirmationSchema, cashConfirmationSchema, cancellationSchema, cancellationResponseSchema } from '@valora/contracts';
import { obj, uuid, num, str, nil, arr, ref, date } from './helpers.js';
import type { Route } from './types.js';

export const transactionsInputs = {
CashConfirmationInput: cashConfirmationSchema,
ConfirmationInput: confirmationSchema,
CancellationInput: cancellationSchema,
CancellationResponseInput: cancellationResponseSchema
};

export const transactionsOutputs = {
CashConfirmation: obj({ id: uuid, actorId: uuid, kind: { type: 'string', enum: ['SENT', 'RECEIVED'] }, confirmedAt: date, source: { type: 'string', enum: ['USER_REPORTED'] } }),
TransactionItemSnapshot: obj({ id: uuid, itemRevision: num, assessmentId: uuid, title: str, description: str, conditionSummary: nil(str), categoryCode: str, subcategoryCode: nil(str), estimatedWeightGrams: nil(num), mediaIds: arr(uuid), fromUserId: uuid, toUserId: uuid }),
TransactionSnapshot: obj({ listingRevisionId: uuid, offerRevisionId: uuid, items: arr(ref('TransactionItemSnapshot')), parties: arr(obj({ id: uuid, displayName: str })), handoverMethods: arr(str), cashAdjustment: nil(ref('CashAdjustment')) }),
Confirmation: obj({ id: uuid, actorId: uuid, itemId: uuid, kind: { type: 'string', enum: ['HANDED_OVER', 'RECEIVED'] }, confirmedAt: date, source: str }),
RequiredConfirmation: obj({ actorId: uuid, itemId: uuid, kind: str }),
Cancellation: obj({ id: uuid, requestedById: uuid, reason: str, status: str, endReason: nil(str), createdAt: date, respondedAt: nil(date) }),
Transaction: obj({ id: uuid, listingId: uuid, offerId: uuid, type: str, status: str, sellerOrDonorId: uuid, buyerOrRecipientId: uuid, finalPriceIdr: nil(num), snapshot: ref('TransactionSnapshot'), acceptedAt: date, targetHandoverAt: date, overdueAt: nil(date), completedAt: nil(date), cancelledAt: nil(date), resolutionOrigin: nil(str), correctedAt: nil(date), version: num, confirmations: arr(ref('Confirmation')), cashConfirmations: arr(ref('CashConfirmation')), cancellations: arr(ref('Cancellation')), disputes: arr(ref('Dispute')), corrections: arr(ref('CorrectionMeta')), conversationId: nil(uuid), requiredConfirmations: arr(ref('RequiredConfirmation')) }),
OverdueTransaction: obj({ id: uuid, title: str, targetHandoverAt: date, overdueAt: date, version: num }),
Notification: obj({ id: uuid, userId: uuid, eventKey: str, type: str, payload: obj({ transactionId: uuid, title: str, day: num }, ['transactionId', 'title']), createdAt: date, readAt: nil(date) })
};

export const transactionsRoutes: Route[] = [
{ order: 21, method: 'post', path: '/transactions/{id}/cash-confirmations', input: 'CashConfirmationInput', output: ref('Transaction'), auth: true, idempotent: true },
{ order: 0, method: 'post', path: '/admin/transactions/{id}/open-case', input: 'CancellationInput', output: obj({ caseId: uuid }), auth: true, idempotent: true },
{ order: 1, method: 'post', path: '/offers/{id}/accept', input: 'OfferAcceptInput', output: ref('Transaction'), auth: true, idempotent: true },
{ order: 2, method: 'get', path: '/me/transactions', output: arr(ref('Transaction')), auth: true, query: ['cursor', 'limit', 'status'] },
{ order: 3, method: 'get', path: '/transactions/{id}', output: ref('Transaction'), auth: true },
{ order: 4, method: 'post', path: '/transactions/{id}/confirmations', input: 'ConfirmationInput', output: ref('Transaction'), auth: true, idempotent: true },
{ order: 5, method: 'post', path: '/transactions/{id}/cancellation-requests', input: 'CancellationInput', output: ref('Transaction'), auth: true, idempotent: true },
{ order: 6, method: 'post', path: '/transactions/{id}/cancellation-requests/{requestId}/respond', input: 'CancellationResponseInput', output: ref('Transaction'), auth: true, idempotent: true },
{ order: 18, method: 'post', path: '/admin/transactions/{id}/resolve-dispute', input: 'ResolveDisputeInput', output: ref('Transaction'), auth: true, idempotent: true },
{ order: 19, method: 'get', path: '/notifications', output: arr(ref('Notification')), auth: true },
{ order: 20, method: 'post', path: '/notifications/{id}/read', output: obj({ read: { type: 'boolean' } }), auth: true },
{ order: 46, method: 'get', path: '/admin/transactions', output: arr(ref('AdminTransactionMetadata')), auth: true, query: ['q', 'status', 'cursor'] },
{ order: 47, method: 'get', path: '/admin/transactions/{id}', output: ref('AdminTransactionMetadata'), auth: true }
];
