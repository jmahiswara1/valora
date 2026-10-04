import { economicReferenceCreateSchema } from '@valora/contracts';
import { obj, uuid, str, nil, num, ref, date, arr, result, bool, array, object, integer, text } from './helpers.js';
import type { Route } from './types.js';

export const adminInputs = {
EconomicReferenceInput: economicReferenceCreateSchema
};

export const adminOutputs = {
AdminCaseDetail: obj({ id: uuid, transactionId: uuid, status: str, assignedAdminId: nil(uuid), resolution: nil(str), version: num, transaction: nil(ref('Transaction')), createdAt: date, resolvedAt: nil(date) }),
AdminUser: obj({ id: uuid, displayName: str, email: str, role: str, status: str, version: num, createdAt: date }, ['id', 'displayName', 'email', 'role', 'status', 'version']),
AdminTransactionMetadata: obj({ id: uuid, itemId: uuid, offeredItemId: nil(uuid), type: str, status: str, version: num, acceptedAt: date, completedAt: nil(date), correctedAt: nil(date), targetHandoverAt: date }),
AuditMetadata: obj({ id: uuid, adminId: uuid, targetType: str, targetId: uuid, action: str, createdAt: date })
};

export const adminRoutes: Route[] = [
{ order: 41, method: 'get', path: '/admin/dashboard', output: obj({ stage: num, queues: obj({ moderation: num, reports: num, disputes: num, corrections: num, overdue: num }), impact: ref('Impact') }), auth: true },
{ order: 42, method: 'get', path: '/admin/users', output: arr(ref('AdminUser')), auth: true, query: ['q', 'status', 'cursor'] },
{ order: 43, method: 'get', path: '/admin/users/{id}', output: ref('AdminUser'), auth: true },
{ order: 44, method: 'post', path: '/admin/users/{id}/' + "suspend", input: 'VersionReasonInput', output: result, auth: true, idempotent: true },
{ order: 45, method: 'post', path: '/admin/users/{id}/' + "release", input: 'VersionReasonInput', output: result, auth: true, idempotent: true },
{ order: 60, method: 'get', path: '/admin/rubrics', output: obj({ published: arr(ref('Rubric')), drafts: arr({ type: 'object' }), categories: arr({ type: 'object' }), references: arr({ type: 'object' }) }), auth: true },
{ order: 61, method: 'post', path: '/admin/rubrics/drafts', input: 'RubricDraftInput', output: result, auth: true, idempotent: true },
{ order: 62, method: 'post', path: '/admin/rubrics/drafts/{id}', input: 'RubricDraftUpdateInput', output: result, auth: true, idempotent: true },
{ order: 63, method: 'get', path: '/admin/rubrics/drafts/{id}/tests', output: ref('RubricFixture'), auth: true },
{ order: 64, method: 'post', path: '/admin/rubrics/drafts/{id}/publish', input: 'VersionReasonInput', output: ref('Rubric'), auth: true, idempotent: true },
{ order: 65, method: 'post', path: '/admin/categories/{code}', input: 'CategoryAdminInput', output: obj({ code: str, name: str, active: bool, updatedAt: date }), auth: true, idempotent: true },
{ order: 66, method: 'post', path: '/admin/economic-references/{id}/' + "activate", input: 'VersionReasonInput', output: result, auth: true, idempotent: true },
{ order: 67, method: 'post', path: '/admin/economic-references/{id}/' + "deactivate", input: 'VersionReasonInput', output: result, auth: true, idempotent: true },
{ order: 68, method: 'post', path: '/admin/economic-references', input: 'EconomicReferenceInput', output: result, auth: true, idempotent: true },
{ order: 69, method: 'get', path: '/categories/{code}/economic-references', output: arr(obj({ id: uuid, field: str, amountIdr: str, sourceNote: str, referenceDate: str, region: str })) },
{ order: 70, method: 'get', path: '/admin/analytics', output: obj({ from: nil(date), to: nil(date), transactionCompletion: obj({ numerator: num, denominator: num, value: nil({ type: 'number' }), definition: str }), moderationApproval: obj({ numerator: num, denominator: num, value: nil({ type: 'number' }), definition: str }), impact: ref('Impact') }), auth: true, query: ['from', 'to'] },
{ order: 71, method: 'get', path: '/admin/audit', output: arr(ref('AuditMetadata')), auth: true, query: ['cursor', 'targetType'] },
{ order: 72, method: 'get', path: '/admin/audit/{id}', output: { type: 'object' }, auth: true, query: ['scopeType', 'scopeId'] },
{ order: 94, method: 'get', path: '/categories', output: array(ref('Category')) },
{ order: 95, method: 'get', path: '/categories/{code}/rubric', output: ref('Rubric') },
{ order: 96, method: 'get', path: '/admin/overview', auth: true, output: object({ stage: integer, message: text }) }
];
