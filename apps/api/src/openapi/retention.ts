import { retentionHoldSchema } from '@valora/contracts';
import { obj, uuid, str, date, nil, num, arr, ref } from './helpers.js';
import type { Route } from './types.js';

export const retentionInputs = {
RetentionHoldInput: retentionHoldSchema
};

export const retentionOutputs = {
RetentionHold: obj({ id: uuid, scopeType: str, scopeId: uuid, adminId: uuid, reviewAt: date, revokedAt: nil(date), version: num, createdAt: date }),
MaintenanceRun: obj({ id: uuid, job: str, status: str, startedAt: date, completedAt: nil(date), counts: nil(obj({ messages: num, cases: num, accounts: num, storage: num }, [])) })
};

export const retentionRoutes: Route[] = [
{ order: 73, method: 'get', path: '/admin/retention/holds', query: ['cursor'], output: arr(ref('RetentionHold')), auth: true },
{ order: 74, method: 'post', path: '/admin/retention/holds', input: 'RetentionHoldInput', output: ref('RetentionHold'), auth: true, idempotent: true },
{ order: 75, method: 'post', path: '/admin/retention/holds/{id}/release', input: 'VersionReasonInput', output: ref('RetentionHold'), auth: true, idempotent: true },
{ order: 76, method: 'get', path: '/admin/retention/runs', output: arr(ref('MaintenanceRun')), auth: true }
];
