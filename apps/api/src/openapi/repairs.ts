import { repairCreateSchema, repairCorrectionSchema, repairVoidSchema } from '@valora/contracts';
import { object, uuid, date, text, nullable, integer, array, ref } from './helpers.js';
import type { Route } from './types.js';

export const repairsInputs = {
RepairCreateInput: repairCreateSchema,
RepairCorrectionInput: repairCorrectionSchema,
RepairVoidInput: repairVoidSchema
};

export const repairsOutputs = {
Repair: object({ id: uuid, itemId: uuid, createdById: uuid, performedAt: date, actionSummary: text, privateNotes: nullable(text), costIdr: nullable(integer), costKind: nullable(text), outcome: text, afterCondition: text, status: text, shareSummaryPublic: { type: 'boolean' }, shareDetailsWithFutureOwner: { type: 'boolean' }, evidence: array(ref('Media')), voidReason: nullable(text), version: integer, createdAt: date, origin: text }, ['id', 'itemId', 'performedAt', 'actionSummary', 'outcome', 'afterCondition', 'status', 'shareSummaryPublic', 'evidence', 'version', 'createdAt', 'origin'])
};

export const repairsRoutes: Route[] = [
{ order: 107, method: 'post', path: '/items/{itemId}/repairs', auth: true, input: 'RepairCreateInput', output: ref('Repair') },
{ order: 108, method: 'get', path: '/items/{itemId}/repairs', auth: true, output: array(ref('Repair')) },
{ order: 110, method: 'post', path: '/repairs/{id}/void', auth: true, idempotent: true, input: 'RepairVoidInput', output: ref('Repair') }
];
