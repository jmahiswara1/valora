import { disputeSchema, evidenceSchema, caseAccessSchema, caseClaimSchema, caseMediaTicketSchema, resolveDisputeSchema } from '@valora/contracts';
import { obj, uuid, str, nil, num, date, arr, ref } from './helpers.js';
import type { Route } from './types.js';

export const disputesInputs = {
DisputeInput: disputeSchema,
EvidenceInput: evidenceSchema,
CaseAccessInput: caseAccessSchema,
CaseClaimInput: caseClaimSchema,
CaseMediaTicketInput: caseMediaTicketSchema,
ResolveDisputeInput: resolveDisputeSchema
};

export const disputesOutputs = {
Dispute: obj({ id: uuid, transactionId: uuid, status: str, assignedAdminId: nil(uuid), reason: str, resolution: nil(str), resolutionReason: nil(str), version: num, createdAt: date, resolvedAt: nil(date), transactionVersion: num, transactionTitle: str, overdueAt: nil(date) }, ['id', 'transactionId', 'status', 'assignedAdminId', 'resolution', 'version', 'createdAt', 'resolvedAt']),
Evidence: obj({ id: uuid, caseId: uuid, submittedById: uuid, note: nil(str), message: nil(obj({ id: uuid, senderId: uuid, body: str, sentAt: date, attachments: arr(ref('MessageAttachment')) })), media: arr(ref('Media')), createdAt: date }),
CaseDetail: obj({ id: uuid, transactionId: uuid, status: str, reason: str, assignedAdminId: nil(uuid), resolution: nil(str), resolutionReason: nil(str), version: num, createdAt: date, resolvedAt: nil(date), evidence: arr(ref('Evidence')) }),
CaseGrant: obj({ grantId: uuid, expiresAt: date })
};

export const disputesRoutes: Route[] = [
{ order: 7, method: 'post', path: '/transactions/{id}/disputes', input: 'DisputeInput', output: ref('Transaction'), auth: true, idempotent: true },
{ order: 8, method: 'get', path: '/cases/{id}', output: ref('CaseDetail'), auth: true },
{ order: 9, method: 'post', path: '/cases/{id}/evidence', input: 'EvidenceInput', output: ref('Evidence'), auth: true, idempotent: true },
{ order: 10, method: 'post', path: '/cases/{id}/media/tickets', input: 'CaseMediaTicketInput', output: obj({ ticketId: uuid, uploadUrl: str, expiresAt: date }), auth: true },
{ order: 11, method: 'get', path: '/admin/disputes', output: arr(ref('Dispute')), auth: true, query: ['cursor', 'limit', 'status'] },
{ order: 12, method: 'get', path: '/admin/disputes/{id}', output: ref('AdminCaseDetail'), auth: true },
{ order: 13, method: 'post', path: '/admin/disputes/{id}/claim', input: 'CaseClaimInput', output: obj({ claimed: { type: 'boolean' } }), auth: true, idempotent: true },
{ order: 14, method: 'post', path: '/admin/cases/{id}/chat-access', input: 'CaseAccessInput', output: ref('CaseGrant'), auth: true, idempotent: true },
{ order: 15, method: 'post', path: '/admin/cases/{id}/evidence-access', input: 'CaseAccessInput', output: ref('CaseGrant'), auth: true, idempotent: true },
{ order: 16, method: 'get', path: '/admin/cases/{id}/messages', output: arr(ref('Message')), auth: true, query: ['before'] },
{ order: 17, method: 'get', path: '/admin/cases/{id}/evidence', output: arr(ref('Evidence')), auth: true }
];
