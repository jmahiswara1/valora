import { rubricDraftSchema, rubricDraftUpdateSchema, explanationSchema, assessmentCreateSchema } from '@valora/contracts';
import { obj, bool, arr, str, object, uuid, text, date, nullable, array, integer, ref } from './helpers.js';
import type { Route } from './types.js';

export const assessmentsInputs = {
RubricDraftInput: rubricDraftSchema,
RubricDraftUpdateInput: rubricDraftUpdateSchema,
Explanation: explanationSchema,
AssessmentCreateInput: assessmentCreateSchema
};

export const assessmentsOutputs = {
RubricFixture: obj({ passed: bool, tests: arr(obj({ name: str, passed: bool })) }),
Rubric: object({ id: uuid, rubricKey: text, ruleVersion: text, policyVersion: text, recommendationVersion: text, effectiveAt: date, contextPrompt: nullable(text), questions: array(object({ key: text, prompt: text, choices: array(object({ code: text, label: text, value: integer })) })), safetyQuestions: array(object({ code: text, prompt: text, effectOnYes: text })) }),
Recommendation: object({ action: text, status: text, reasons: array(text) }),
Assessment: object({ id: uuid, itemId: uuid, itemRevision: integer, rubricVersionId: uuid, ruleVersion: text, policyVersion: text, recommendationVersion: text, rubric: ref('Rubric'), status: text, condition: nullable(integer), repairability: nullable(integer), repairabilityReason: nullable(text), economicValue: nullable(integer), reusePotential: nullable(integer), score: nullable(integer), label: nullable(text), missingFields: array(text), safetyFlags: array(text), recommendations: array(ref('Recommendation')), answers: nullable({ type: 'object' }), economicSources: nullable({ type: 'object' }), createdAt: date, isCurrent: { type: 'boolean' }, origin: text })
};

export const assessmentsRoutes: Route[] = [
{ order: 35, method: 'post', path: '/assessments/{id}/explain', output: ref('Explanation'), auth: true },
{ order: 104, method: 'post', path: '/items/{itemId}/assessments', auth: true, input: 'AssessmentCreateInput', output: ref('Assessment') },
{ order: 105, method: 'get', path: '/items/{itemId}/assessments', auth: true, output: array(ref('Assessment')) },
{ order: 106, method: 'get', path: '/assessments/{id}', auth: true, output: ref('Assessment') }
];
