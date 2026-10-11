import { itemCreateSchema, itemPatchSchema, photoAnalysisInputSchema, photoAnalysisSchema } from '@valora/contracts';
import { object, uuid, text, nullable, integer, date, array, ref } from './helpers.js';
import type { Route } from './types.js';

export const itemsInputs = {
ItemCreateInput: itemCreateSchema,
ItemPatchInput: itemPatchSchema,
PhotoAnalysisInput: photoAnalysisInputSchema,
PhotoAnalysis: photoAnalysisSchema
};

export const itemsOutputs = {
Item: object({ id: uuid, title: text, description: text, categoryCode: text, subcategoryCode: nullable(text), functionSummary: nullable(text), conditionSummary: nullable(text), completenessSummary: nullable(text), issueSummary: nullable(text), purchaseYear: nullable(integer), originalPriceIdr: nullable(integer), estimatedWeightGrams: nullable(integer), reservedByTransactionId: nullable(uuid), itemRevision: integer, version: integer, createdAt: date, updatedAt: date, media: array(ref('Media')) })
};

export const itemsRoutes: Route[] = [
{ order: 96, method: 'post', path: '/items/photo-analysis', auth: true, input: 'PhotoAnalysisInput', output: ref('PhotoAnalysis') },
{ order: 97, method: 'get', path: '/items', auth: true, output: array(ref('Item')) },
{ order: 98, method: 'post', path: '/items', auth: true, input: 'ItemCreateInput', output: ref('Item') },
{ order: 99, method: 'get', path: '/items/{id}', auth: true, output: ref('Item') },
{ order: 100, method: 'patch', path: '/items/{id}', auth: true, input: 'ItemPatchInput', output: ref('Item') }
];
