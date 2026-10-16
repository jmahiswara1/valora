import { tutorialCreateSchema, tutorialActionSchema, tutorialQuestionSchema, tutorialPhotoTicketSchema, tutorialPhotoFinalizeSchema, tutorialRecordSchema } from '@valora/contracts';
import { object, ref, array, text, integer, uuid, date, nullable, bool, ticket } from './helpers.js';
import type { Route } from './types.js';

export const tutorialsInputs = { TutorialCreateInput: tutorialCreateSchema, TutorialActionInput: tutorialActionSchema, TutorialQuestionInput: tutorialQuestionSchema, TutorialPhotoTicketInput: tutorialPhotoTicketSchema, TutorialPhotoFinalizeInput: tutorialPhotoFinalizeSchema, TutorialRecordInput: tutorialRecordSchema };
const block = object({ id: text, text });
const guide = object({ id: text, version: integer, hash: text, title: text, goal: text, categoryCodes: array(text), subcategoryCodes: array(text), activityKind: { type: 'string', enum: ['REPAIR', 'MAINTENANCE'] }, scope: text, exclusions: array(text), preparation: array(object({ id: text, question: text, requiredAnswer: { type: 'string', enum: ['YES', 'NO'] } })), tools: array(text), steps: array(object({ id: text, title: text, instruction: text, simple: text, expected: text, stop: array(text), alternatives: array(block), faq: array(block), illustration: object({ src: text, alt: text, caption: text }) }, ['id', 'title', 'instruction', 'simple', 'expected', 'stop', 'alternatives', 'faq'])), sources: array(object({ title: text, url: { type: 'string', format: 'uri' }, reviewedAt: text })) });
const photo = object({ id: uuid, stepId: text, bytes: integer, width: integer, height: integer, createdAt: date });
const mutation = object({ id: uuid, version: integer, recordId: uuid }, ['id', 'version']);
export const tutorialsOutputs = {
  RepairGuide: guide,
  TutorialMutation: mutation,
  TutorialSession: object({ id: uuid, itemId: uuid, itemTitle: text, itemVersion: nullable(integer), itemCondition: nullable(text), guide, state: { type: 'string', enum: ['PREFLIGHT', 'IN_PROGRESS', 'PAUSED', 'BLOCKED', 'REVIEW', 'RECORDED', 'STOPPED', 'INVALIDATED'] }, reason: nullable(text), problem: text, answers: { type: 'object', additionalProperties: { type: 'string', enum: ['YES', 'NO', 'UNKNOWN'] } }, completedSteps: array(text), performedActions: array(text), version: integer, startedAt: nullable(date), closedAt: nullable(date), createdAt: date, purgedAt: nullable(date), recordId: nullable(uuid), draft: nullable(ref('RepairCreateInput')), draftPhotoIds: array(uuid), photos: array(photo), capabilities: object({ canStart: bool, canContinue: bool, canAsk: bool, canRecord: bool, canClose: bool }) }),
  TutorialInteraction: object({ id: uuid, requestId: uuid, stepId: text, question: text, photoIds: array(uuid), status: { type: 'string', enum: ['PENDING', 'ANSWERED', 'UNAVAILABLE', 'STALE'] }, createdAt: date, reply: nullable(object({ source: { type: 'string', enum: ['AI', 'CATALOG', 'UNAVAILABLE'] }, intent: { type: 'string', enum: ['EXPLAIN', 'ALTERNATIVE', 'CLARIFY', 'OUT_OF_SCOPE', 'STOP'] }, blocks: array(block), observations: array(text), questions: array(text), reason: text }, ['source', 'intent', 'blocks', 'observations', 'questions'])) }),
};
export const tutorialsRoutes: Route[] = [
  { order: 300, method: 'get', path: '/repair-guides', auth: true, output: object({ enabled: bool, guides: array(guide) }) },
  { order: 301, method: 'get', path: '/repair-guides/{guideId}', auth: true, output: guide },
  { order: 302, method: 'get', path: '/items/{itemId}/repair-tutorials', auth: true, output: object({ enabled: bool, itemVersion: integer, guides: array(guide), unclosedSessionId: nullable(uuid) }) },
  { order: 303, method: 'post', path: '/items/{itemId}/repair-tutorial-sessions', auth: true, idempotent: true, input: 'TutorialCreateInput', output: mutation },
  { order: 304, method: 'get', path: '/repair-tutorial-sessions/mine', auth: true, query: ['cursor', 'state'], output: array(object({ id: uuid, itemId: uuid, itemTitle: text, title: text, activityKind: text, state: text, completedSteps: integer, totalSteps: integer, createdAt: date, recordId: nullable(uuid) })) },
  { order: 305, method: 'get', path: '/repair-tutorial-sessions/{id}', auth: true, output: ref('TutorialSession') },
  { order: 306, method: 'get', path: '/repair-tutorial-sessions/{id}/start-preview', auth: true, output: object({ sessionId: uuid, expectedVersion: integer, expectedItemVersion: integer, impactHash: text, listings: array(object({ id: uuid, title: text, status: text, version: integer })), relatedOfferCount: integer }) },
  { order: 307, method: 'post', path: '/repair-tutorial-sessions/{id}/actions', auth: true, idempotent: true, input: 'TutorialActionInput', output: mutation },
  { order: 308, method: 'post', path: '/repair-tutorial-sessions/{id}/questions', auth: true, input: 'TutorialQuestionInput', output: ref('TutorialInteraction') },
  { order: 309, method: 'get', path: '/repair-tutorial-sessions/{id}/questions', auth: true, query: ['cursor', 'stepId'], output: array(ref('TutorialInteraction')) },
  { order: 310, method: 'get', path: '/repair-tutorial-sessions/{id}/questions/by-request/{requestId}', auth: true, output: ref('TutorialInteraction') },
  { order: 311, method: 'post', path: '/repair-tutorial-sessions/{id}/photos/tickets', auth: true, input: 'TutorialPhotoTicketInput', output: ticket },
  { order: 312, method: 'post', path: '/repair-tutorial-sessions/{id}/photos/finalize', auth: true, input: 'TutorialPhotoFinalizeInput', output: object({ id: uuid }) },
  { order: 313, method: 'get', path: '/repair-tutorial-photos/{id}/access', auth: true, output: object({ url: text, expiresAt: date }) },
  { order: 314, method: 'get', path: '/repair-tutorial-photos/{id}/private', auth: true, binary: true, query: ['expires', 'signature'], output: { type: 'string', format: 'binary' } },
  { order: 315, method: 'delete', path: '/repair-tutorial-photos/{id}', auth: true, output: object({ id: uuid }) },
  { order: 316, method: 'post', path: '/repair-tutorial-sessions/{id}/record', auth: true, idempotent: true, input: 'TutorialRecordInput', output: mutation },
];
