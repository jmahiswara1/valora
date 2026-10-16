import { passportRestrictionSchema } from '@valora/contracts';
import { obj, uuid, str, num, nil, arr, date, bool, ref } from './helpers.js';
import type { Route } from './types.js';

export const historyInputs = {
PassportRestrictionInput: passportRestrictionSchema
};

export const historyOutputs = {
Passport: obj({ itemId: uuid, categoryCode: str, visibility: str, projection: str, version: num, title: nil(str), description: nil(str), media: arr(obj({ id: uuid, url: str })), timeline: arr(obj({ id: uuid, type: str, origin: str, occurredAt: date, recordedAt: date, correctionOfId: nil(uuid), summary: str, assessment: obj({ status: str, score: nil(num), label: nil(str), ruleVersion: str, historical: bool, valid: bool }), repair: obj({ activityKind: str, summary: str, afterCondition: str, status: str, outcome: str }) }, ['id', 'type', 'origin', 'occurredAt', 'recordedAt', 'correctionOfId', 'summary'])), share: obj({ url: { type: 'string', format: 'uri' }, access: { type: 'string', enum: ['PUBLIC', 'LIMITED', 'UNAVAILABLE'] } }) }),
Impact: obj({ from: nil(date), to: nil(date), metrics: arr(obj({ metric: str, value: nil({ type: 'string', pattern: '^-?[0-9]+$' }), unit: str })), weightCoverage: obj({ known: str, total: str }), notes: arr(str) })
};

export const historyRoutes: Route[] = [
{ order: 29, method: 'get', path: '/passport/{id}', output: ref('Passport') },
{ order: 30, method: 'get', path: '/passport/{id}/media/{mediaId}', output: { type: 'string', format: 'binary' }, binary: true },
{ order: 31, method: 'get', path: '/items/{id}/passport', output: ref('Passport'), auth: true },
{ order: 32, method: 'get', path: "/impact/public", output: ref('Impact'), query: ['from', 'to'], auth: false },
{ order: 33, method: 'get', path: "/me/impact", output: ref('Impact'), query: ['from', 'to'], auth: true },
{ order: 34, method: 'get', path: "/admin/impact", output: ref('Impact'), query: ['from', 'to'], auth: true },
{ order: 56, method: 'post', path: '/admin/passport/{id}/visibility', input: 'PassportRestrictionInput', output: obj({ itemId: uuid, visibility: str, version: num }), auth: true, idempotent: true }
];
