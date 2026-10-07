import { reauthenticateSchema, actionStatusSchema, registerSchema, loginSchema, verifyEmailSchema, resetRequestSchema, resetConfirmSchema, profilePatchSchema, passwordChangeSchema, accountCloseSchema } from '@valora/contracts';
import { obj, nil, str, date, ref, uuid, object, text, nullable, array } from './helpers.js';
import type { Route } from './types.js';

export const authInputs = {
ReauthenticateInput: reauthenticateSchema,
ActionStatusInput: actionStatusSchema,
RegisterInput: registerSchema,
LoginInput: loginSchema,
VerifyEmailInput: verifyEmailSchema,
EmailInput: resetRequestSchema,
ResetConfirmInput: resetConfirmSchema,
ProfilePatchInput: profilePatchSchema,
PasswordChangeInput: passwordChangeSchema,
AccountCloseInput: accountCloseSchema
};

export const authOutputs = {
Session: obj({ state: { type: 'string', enum: ['GUEST', 'AUTHENTICATED', 'RESTRICTED'] }, reason: nil(str), serverTime: date, user: nil(ref('User')), sessionId: nil(uuid), expiresAt: nil(date), reauthenticatedUntil: nil(date) }),
ActiveSession: obj({ id: uuid, createdAt: date, lastSeenAt: date, expiresAt: date, current: { type: 'boolean' } }),
ActionStatus: obj({ status: { type: 'string', enum: ['COMMITTED', 'PURGED', 'NOT_FOUND'] }, completedAt: nil(date) }),
User: object({ profilePhotoPublic: { type: 'boolean' }, id: uuid, email: text, displayName: text, city: ref('City'), role: { type: 'string', enum: ['USER', 'ADMIN'] }, status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'CLOSED'] }, emailVerifiedAt: nullable(date), profilePhotoProvider: nullable({ type: 'string', enum: ['LOCAL', 'CLOUDINARY'] }), profilePhotoUrl: nullable(text), profilePhotoMigrationAvailable: { type: 'boolean' } })
};

export const authRoutes: Route[] = [
{ order: 21, method: 'get', path: '/auth/session', output: ref('Session') },
{ order: 22, method: 'post', path: '/auth/reauthenticate', input: 'ReauthenticateInput', output: obj({ reauthenticatedUntil: date }), auth: true },
{ order: 23, method: 'get', path: '/me/sessions', output: { type: 'array', items: ref('ActiveSession') }, query: ['cursor'], auth: true },
{ order: 24, method: 'delete', path: '/me/sessions/{id}', output: obj({ revoked: { type: 'integer' } }), auth: true },
{ order: 25, method: 'post', path: '/me/sessions/revoke-others', output: obj({ revoked: { type: 'integer' } }), auth: true },
{ order: 26, method: 'post', path: '/me/actions/status', input: 'ActionStatusInput', output: ref('ActionStatus'), auth: true },
{ order: 77, method: 'get', path: '/auth/csrf', output: object({ token: text }) },
{ order: 78, method: 'post', path: '/auth/register', input: 'RegisterInput', output: object({ id: uuid, email: text, emailVerifiedAt: { type: 'null' } }) },
{ order: 79, method: 'post', path: '/auth/verify-email', input: 'VerifyEmailInput', output: object({ emailVerifiedAt: date }) },
{ order: 80, method: 'post', path: '/auth/verification/resend', input: 'EmailInput', output: object({ message: text }) },
{ order: 81, method: 'post', path: '/auth/login', input: 'LoginInput', output: ref('User') },
{ order: 82, method: 'post', path: '/auth/logout', output: object({ loggedOut: { type: 'boolean' } }) },
{ order: 83, method: 'post', path: '/auth/password-reset/request', input: 'EmailInput', output: object({ message: text }) },
{ order: 84, method: 'post', path: '/auth/password-reset/confirm', input: 'ResetConfirmInput', output: object({ passwordChanged: { type: 'boolean' } }) },
{ order: 85, method: 'get', path: '/me', auth: true, output: ref('User') },
{ order: 86, method: 'patch', path: '/me', auth: true, input: 'ProfilePatchInput', output: ref('User') },
{ order: 91, method: 'patch', path: '/me/password', auth: true, input: 'PasswordChangeInput', output: object({ passwordChanged: { type: 'boolean' } }) },
{ order: 92, method: 'post', path: '/me/close', auth: true, input: 'AccountCloseInput', output: object({ closedAt: date, pendingTransactionIds: array(uuid) }) }
];
