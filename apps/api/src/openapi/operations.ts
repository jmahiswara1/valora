import { correctionOpenSchema, correctionEvidenceSchema, ownershipCorrectionSchema, impactCorrectionSchema, sourceCorrectionSchema, reportCreateSchema, reportReviewSchema } from '@valora/contracts';
import { obj, uuid, str, nil, num, date, ref, bool, object, text, nullable, integer, arr, result, array } from './helpers.js';
import type { Route } from './types.js';

export const operationsInputs = {
CorrectionOpenInput: correctionOpenSchema,
CorrectionEvidenceInput: correctionEvidenceSchema,
OwnershipCorrectionInput: ownershipCorrectionSchema,
ImpactCorrectionInput: impactCorrectionSchema,
SourceCorrectionInput: sourceCorrectionSchema,
ReportCreateInput: reportCreateSchema,
ReportReviewInput: reportReviewSchema
};

export const operationsOutputs = {
CorrectionMeta: obj({ id: uuid, transactionId: uuid, status: str, assignedAdminId: nil(uuid), version: num, resolution: nil(str), createdAt: date, resolvedAt: nil(date) }),
OperationsGrant: obj({ id: uuid, expiresAt: date }),
CorrectionResult: obj({ case: ref('CorrectionMeta'), reversed: bool }),
ReportCreated: object({ id: uuid, status: text, createdAt: date }),
AdminReport: object({ id: uuid, targetType: text, targetId: uuid, reasonCode: text, assignedAdminId: nullable(uuid), version: integer, status: text, createdAt: date, listingStatus: text, listingVersion: integer, listingTitle: text }, ['id', 'targetType', 'targetId', 'reasonCode', 'assignedAdminId', 'version', 'status', 'createdAt'])
};

export const operationsRoutes: Route[] = [
{ order: 27, method: 'get', path: '/admin/reports/{id}/metadata', output: { type: 'object' }, auth: true },
{ order: 28, method: 'get', path: '/admin/correction-cases/{id}/metadata', output: ref('CorrectionMeta'), auth: true },
{ order: 36, method: 'post', path: '/transactions/{id}/corrections', input: 'CorrectionOpenInput', output: ref('CorrectionMeta'), auth: true, idempotent: true },
{ order: 37, method: 'get', path: '/correction-cases/{id}', output: obj({ id: uuid, transactionId: uuid, status: str, version: num, reason: str, evidence: arr(obj({ id: uuid, note: str, messageSnapshot: nil(obj({ body: str, sentAt: date })), media: arr(obj({ id: uuid, url: str })), createdAt: date, purgedAt: nil(date) })), transaction: obj({ id: uuid, version: num, type: str, finalPriceIdr: nil(str), correctedAt: nil(date), items: arr(obj({ id: uuid, title: str, estimatedWeightGrams: nil(num), assessmentId: uuid })) }) }), auth: true },
{ order: 38, method: 'post', path: '/correction-cases/{id}/evidence', input: 'CorrectionEvidenceInput', output: ref('CorrectionMeta'), auth: true, idempotent: true },
{ order: 39, method: 'post', path: '/correction-cases/{id}/media/tickets', input: 'CaseMediaTicketInput', output: obj({ ticketId: uuid, uploadUrl: str, expiresAt: date }), auth: true },
{ order: 40, method: 'get', path: '/correction-cases/{id}/media/{mediaId}', output: { type: 'string', format: 'binary' }, binary: true, auth: true },
{ order: 48, method: 'get', path: '/admin/correction-cases', query: ['cursor'], output: arr(ref('CorrectionMeta')), auth: true },
{ order: 49, method: 'post', path: '/admin/correction-cases/{id}/' + "claim", input: 'VersionReasonInput', output: ref('CorrectionMeta'), auth: true, idempotent: true },
{ order: 50, method: 'post', path: '/admin/correction-cases/{id}/' + "close", input: 'VersionReasonInput', output: ref('CorrectionMeta'), auth: true, idempotent: true },
{ order: 51, method: 'post', path: '/admin/correction-cases/{id}/access', input: 'AccessReasonInput', output: ref('OperationsGrant'), auth: true, idempotent: true },
{ order: 52, method: 'post', path: '/admin/transactions/{id}/correct', input: 'OwnershipCorrectionInput', output: ref('CorrectionResult'), auth: true, idempotent: true },
{ order: 53, method: 'post', path: '/admin/impact/corrections', input: 'ImpactCorrectionInput', output: obj({ adjusted: bool, version: num }), auth: true, idempotent: true },
{ order: 54, method: 'post', path: '/admin/' + "assessments" + '/{id}/validity', input: 'SourceCorrectionInput', output: obj({ id: uuid, valid: bool, version: num }), auth: true, idempotent: true },
{ order: 55, method: 'post', path: '/admin/' + "repairs" + '/{id}/validity', input: 'SourceCorrectionInput', output: obj({ id: uuid, valid: bool, version: num }), auth: true, idempotent: true },
{ order: 57, method: 'post', path: '/admin/reports/{id}/claim', input: 'VersionReasonInput', output: result, auth: true, idempotent: true },
{ order: 58, method: 'post', path: '/admin/reports/{id}/access', input: 'AccessReasonInput', output: ref('OperationsGrant'), auth: true, idempotent: true },
{ order: 59, method: 'get', path: '/admin/reports/{id}', output: obj({ id: uuid, details: str, status: str, version: num, targetType: str, targetId: uuid, message: nil(obj({ body: str, sentAt: date })) }), auth: true },
{ order: 109, method: 'post', path: '/repairs/{id}/corrections', auth: true, idempotent: true, input: 'RepairCorrectionInput', output: ref('Repair') },
{ order: 144, method: 'post', path: '/reports', auth: true, input: 'ReportCreateInput', output: ref('ReportCreated') },
{ order: 145, method: 'get', path: '/admin/reports', query: ['cursor'], auth: true, output: array(ref('AdminReport')) },
{ order: 146, method: 'post', path: '/admin/reports/{id}/resolve', auth: true, idempotent: true, input: 'ReportReviewInput', output: ref('ActionResult') }
];
