import { listingSaveSchema, listingPatchSchema, moderationDecisionSchema, listingAdminActionSchema, listingAdminReleaseSchema } from '@valora/contracts';
import { object, uuid, integer, text, nullable, array, ref, date } from './helpers.js';
import type { Route } from './types.js';

export const listingsInputs = {
ListingSaveInput: listingSaveSchema,
ListingPatchInput: listingPatchSchema,
ModerationDecisionInput: moderationDecisionSchema,
ListingAdminActionInput: listingAdminActionSchema,
ListingAdminReleaseInput: listingAdminReleaseSchema
};

export const listingsOutputs = {
ListingRevision: object({ id: uuid, itemId: uuid, revisionNo: integer, assessmentId: uuid, itemRevision: integer, title: text, description: text, categoryCode: text, categoryName: text, subcategoryCode: nullable(text), media: array(ref('Media')), city: ref('City'), condition: integer, score: nullable(integer), scoreLabel: nullable(text), ruleVersion: text, conditionDisclosure: text, askingPriceIdr: nullable(integer), exchangePreference: nullable(text), recipientNote: nullable(text), handoverMethods: array(text), createdAt: date }),
Listing: object({ id: uuid, itemId: uuid, type: { type: 'string', enum: ['RESELL', 'EXCHANGE', 'DONATE'] }, status: { type: 'string', enum: ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'RESERVED', 'CLOSED', 'REJECTED', 'WITHDRAWN', 'SUSPENDED'] }, version: integer, currentRevision: nullable(ref('ListingRevision')), createdAt: date, updatedAt: date }),
PublicListing: { oneOf: [object({ id: uuid, type: text, status: { type: 'string', enum: ['ACTIVE'] }, version: integer, owner: object({ id: uuid, displayName: text, city: ref('City') }), revision: ref('ListingRevision'), publishedAt: nullable(date) }), object({ id: uuid, type: text, status: { type: 'string', enum: ['RESERVED'] } })] },
ModerationQueueItem: object({ revisionId: uuid, listingId: uuid, listingType: text, title: text, ownerName: text, cityName: text, specialReview: { type: 'boolean' }, riskFlags: array(text), submittedAt: date, revisionNo: integer, version: integer }),
ModerationDetail: object({ revisionId: uuid, listingId: uuid, listingVersion: integer, listingType: text, ownerName: text, cityName: text, specialReview: { type: 'boolean' }, riskFlags: array(text), submittedAt: date, revision: ref('ListingRevision') })
};

export const listingsRoutes: Route[] = [
{ order: 115, method: 'get', path: '/market', output: array(ref('PublicListing')), query: ['q', 'category', 'type', 'cityId', 'condition', 'minPriceIdr', 'maxPriceIdr', 'sort', 'cursor', 'limit'] },
{ order: 116, method: 'get', path: '/market/{listingId}', output: ref('PublicListing') },
{ order: 117, method: 'get', path: '/market/{listingId}/media/{mediaId}', output: { type: 'string', format: 'binary' }, binary: true },
{ order: 118, method: 'post', path: '/items/{itemId}/listings', auth: true, input: 'ListingSaveInput', output: ref('Listing') },
{ order: 119, method: 'get', path: '/listings/mine', auth: true, output: array(ref('Listing')) },
{ order: 120, method: 'get', path: '/listings/{id}', auth: true, output: ref('Listing') },
{ order: 121, method: 'patch', path: '/listings/{id}', auth: true, input: 'ListingPatchInput', output: ref('Listing') },
{ order: 122, method: 'post', path: '/listings/{id}/submit', auth: true, input: 'VersionActionInput', output: ref('Listing') },
{ order: 123, method: 'post', path: '/listings/{id}/withdraw', auth: true, input: 'VersionActionInput', output: ref('Listing') },
{ order: 124, method: 'get', path: '/admin/listing-reviews', auth: true, output: array(ref('ModerationQueueItem')) },
{ order: 125, method: 'get', path: '/admin/listing-reviews/{revisionId}', auth: true, output: ref('ModerationDetail') },
{ order: 126, method: 'post', path: '/admin/listing-reviews/{revisionId}/decide', auth: true, input: 'ModerationDecisionInput', output: object({ reviewId: uuid, decision: text, listingStatus: text }), idempotent: true },
{ order: 127, method: 'post', path: '/admin/listings/{id}/suspend', auth: true, idempotent: true, input: 'ListingAdminActionInput', output: object({ id: uuid, status: text }) },
{ order: 128, method: 'post', path: '/admin/listings/{id}/release', auth: true, idempotent: true, input: 'ListingAdminReleaseInput', output: object({ id: uuid, status: text }) }
];
