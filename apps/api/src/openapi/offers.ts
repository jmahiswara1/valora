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
OfferRevision: object({ id: uuid, revisionNo: integer, priceIdr: nullable(integer), message: nullable(text), proposedById: uuid, respondsById: uuid, createdAt: date, expiresAt: date }),
Offer: object({ id: uuid, listingId: uuid, listingRevisionId: uuid, bidderId: uuid, exchangeItemId: nullable(uuid), exchangeSnapshot: nullable(ref('TransactionItemSnapshot')), transactionId: nullable(uuid), status: text, endReason: nullable(text), expiresAt: date, version: integer, currentRevision: nullable(ref('OfferRevision')), createdAt: date, listing: object({ title: text, type: text }) })
};

export const offersRoutes: Route[] = [
{ order: 129, method: 'post', path: '/listings/{listingId}/offers', auth: true, input: 'ListingOfferInput', output: ref('Offer') },
{ order: 130, method: 'get', path: '/offers/mine', auth: true, output: array(ref('Offer')) },
{ order: 131, method: 'get', path: '/offers/{id}', auth: true, output: ref('Offer') },
{ order: 132, method: 'post', path: '/offers/{id}/counter', auth: true, input: 'OfferCounterInput', output: ref('Offer') },
{ order: 133, method: 'post', path: '/offers/{id}/reject', auth: true, input: 'OfferDecisionInput', output: ref('Offer') },
{ order: 134, method: 'post', path: '/offers/{id}/withdraw', auth: true, input: 'OfferDecisionInput', output: ref('Offer') }
];
