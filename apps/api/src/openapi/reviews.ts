import { reviewCreateSchema, reviewReplySchema, reviewVisibilitySchema } from '@valora/contracts';
import { object, uuid, text, date, integer, nullable, array, ref, bool } from './helpers.js';
import type { Route } from './types.js';
export const reviewsInputs = { ReviewCreate: reviewCreateSchema, ReviewReply: reviewReplySchema, ReviewVisibility: reviewVisibilitySchema };
export const reviewsOutputs = {
  PublicPerson: object({ id: uuid, displayName: text, profilePhotoUrl: nullable(text) }),
  RatingSummary: object({ average: nullable({ type: 'number' }), count: integer }),
  PublicProfile: object({ id: uuid, displayName: text, profilePhotoUrl: nullable(text), city: nullable(ref('City')), joinedAt: date, rating: ref('RatingSummary') }),
  ReviewReply: object({ id: uuid, body: nullable(text), createdAt: date, version: integer, visibility: { type: 'string', enum: ['VISIBLE', 'HIDDEN'] } }),
  Review: object({ id: uuid, author: ref('PublicPerson'), subjectId: uuid, rating: { type: 'integer', minimum: 1, maximum: 5 }, comment: nullable(text), type: { type: 'string', enum: ['RESELL', 'EXCHANGE', 'DONATE'] }, createdAt: date, version: integer, visibility: { type: 'string', enum: ['VISIBLE', 'HIDDEN'] }, reply: nullable(ref('ReviewReply')) }),
  TransactionReviews: object({ transactionVersion: integer, eligibility: object({ canReview: bool, reason: nullable(text), deadlineAt: nullable(date), target: nullable(ref('PublicPerson')) }), reviews: array(ref('Review')) }),
};
export const reviewsRoutes: Route[] = [
  { order: 180, method: 'get', path: '/profiles/{id}', output: ref('PublicProfile') },
  { order: 181, method: 'get', path: '/profiles/{id}/listings', output: array(ref('PublicListing')), query: ['cursor'] },
  { order: 182, method: 'get', path: '/profiles/{id}/reviews', output: array(ref('Review')), query: ['cursor'] },
  { order: 183, method: 'get', path: '/profiles/{id}/photo', binary: true, output: { type: 'string', format: 'binary' } },
  { order: 184, method: 'get', path: '/transactions/{id}/reviews', auth: true, output: ref('TransactionReviews') },
  { order: 185, method: 'post', path: '/transactions/{id}/reviews', auth: true, idempotent: true, input: 'ReviewCreate', output: ref('Review') },
  { order: 186, method: 'post', path: '/reviews/{id}/reply', auth: true, idempotent: true, input: 'ReviewReply', output: ref('Review') },
  { order: 187, method: 'post', path: '/admin/reviews/{id}/visibility', auth: true, idempotent: true, input: 'ReviewVisibility', output: object({ id: uuid, version: integer, visibility: text }) },
  { order: 188, method: 'post', path: '/admin/review-replies/{id}/visibility', auth: true, idempotent: true, input: 'ReviewVisibility', output: object({ id: uuid, version: integer, visibility: text }) },
];
