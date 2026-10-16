import { offerAcceptSchema, listingOfferSchema, offerCounterSchema, offerDecisionSchema } from '@valora/contracts';
import { object, uuid, integer, nullable, text, date, ref, array } from './helpers.js';
import type { Route } from './types.js';

export const offersInputs = {
OfferAcceptInput: offerAcceptSchema,
ListingOfferInput: listingOfferSchema,
OfferCounterInput: offerCounterSchema,
OfferDecisionInput: offerDecisionSchema
};

export const offersOutputs = {
CashAdjustment: object({ amountIdr: integer, payer: { type: 'string', enum: ['OWNER', 'BIDDER'] } }),
ExchangeTerms: object({ ownerItems: array(ref('TransactionItemSnapshot')), bidderItems: array(ref('TransactionItemSnapshot')), cashAdjustment: nullable(ref('CashAdjustment')) }),
ExchangeCandidate: object({ item: ref('Item'), eligible: { type: 'boolean' }, reason: nullable(text) }),
OfferRevision: object({ id: uuid, revisionNo: integer, priceIdr: nullable(integer), message: nullable(text), proposedById: uuid, respondsById: uuid, createdAt: date, expiresAt: date, exchangeTerms: nullable(ref('ExchangeTerms')), termsHash: nullable(text) }),
Offer: object({ id: uuid, listingId: uuid, listingRevisionId: uuid, bidderId: uuid, exchangeItemId: nullable(uuid), exchangeSnapshot: nullable(ref('TransactionItemSnapshot')), transactionId: nullable(uuid), status: text, endReason: nullable(text), expiresAt: date, version: integer, currentRevision: nullable(ref('OfferRevision')), createdAt: date, listing: object({ title: text, type: text }) })
};

export const offersRoutes: Route[] = [
{ order: 127, method: 'get', path: '/listings/{listingId}/exchange-candidates', auth: true, output: array(ref('ExchangeCandidate')), query: ['cursor', 'limit'] },
{ order: 128, method: 'get', path: '/offers/{id}/revisions', auth: true, output: array(ref('OfferRevision')), query: ['cursor', 'limit'] },
{ order: 129, method: 'post', path: '/listings/{listingId}/offers', auth: true, input: 'ListingOfferInput', output: ref('Offer') },
{ order: 130, method: 'get', path: '/offers/mine', auth: true, output: array(ref('Offer')) },
{ order: 131, method: 'get', path: '/offers/{id}', auth: true, output: ref('Offer') },
{ order: 132, method: 'post', path: '/offers/{id}/counter', auth: true, input: 'OfferCounterInput', output: ref('Offer') },
{ order: 133, method: 'post', path: '/offers/{id}/reject', auth: true, input: 'OfferDecisionInput', output: ref('Offer') },
{ order: 134, method: 'post', path: '/offers/{id}/withdraw', auth: true, input: 'OfferDecisionInput', output: ref('Offer') }
];
