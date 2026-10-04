import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from "../../dist/generated/prisma/client.js";
import { RetentionService } from "../../dist/modules/retention/service.js";
import { StorageService } from "../../dist/infrastructure/storage.service.js";
import { MaintenanceService } from "../../dist/infrastructure/jobs/maintenance.service.js";
import { exclusiveJob } from "../../dist/infrastructure/jobs/lock.js";
import { base, client, check, login, credentials, createItem, createListing, approve } from "../helpers/fixtures.mjs";
if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Stage 6 requires the test database.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const seed = await db.user.findUniqueOrThrow({ where: { email: 'owner.demo@valora.local' } });
const second = spawn(process.execPath, ['dist/main.js'], { env: { ...process.env, API_PORT: '4004' }, stdio: ['ignore', 'ignore', 'ignore'] });
const counts = {}; const mark = (name) => { counts[name] = true; };
async function actor(role = 'USER') { const row = await db.user.create({ data: { email: `stage6-${randomUUID()}@demo.valora.local`, displayName: 'Fixture tahap enam', role, cityId: seed.cityId, passwordHash: seed.passwordHash, emailVerifiedAt: new Date() } }); return { ...row, account: await login(row.email) }; }
const mutate = (account, path, body = {}, key = randomUUID()) => account.request(path, { method: 'POST', body, extraHeaders: { 'Idempotency-Key': key } });
const session = async (account) => check(await account.request('/auth/session'), 200, 'Metadata sesi');
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:4004/api/v1/categories')).ok) { ready = true; break; } } catch {} await new Promise((r) => setTimeout(r, 100)); }
  assert(ready, 'Second API ready');
  const a = await actor(); const b = await actor(); const admin = await actor('ADMIN');
  assert.equal((await session(client())).state, 'GUEST');
  const meta = await session(a.account); assert.equal(meta.state, 'AUTHENTICATED');
  const row = await db.session.findUniqueOrThrow({ where: { id: meta.sessionId } });
  assert(Math.abs(row.expiresAt - row.createdAt - 7 * 86400000) < 1000);
  await db.session.update({ where: { id: row.id }, data: { lastSeenAt: new Date(Date.now() - 360000) } });
  await session(a.account); const touched = await db.session.findUniqueOrThrow({ where: { id: row.id } }); assert(touched.lastSeenAt > row.lastSeenAt);
  await session(a.account); assert.equal((await db.session.findUniqueOrThrow({ where: { id: row.id } })).lastSeenAt.getTime(), touched.lastSeenAt.getTime());
  assert.equal((await a.account.request(`/me/sessions/${(await session(b.account)).sessionId}`, { method: 'DELETE' })).status, 404);
  const other = await login(a.email); const otherMeta = await session(other);
  assert.equal(check(await a.account.request('/me/sessions'), 200, 'Daftar sesi').length, 2);
  await db.session.update({ where: { id: row.id }, data: { reauthenticatedAt: new Date(Date.now() - 900001) } });
  assert.equal((await mutate(a.account, '/me/sessions/revoke-others')).payload.error.code, 'REAUTHENTICATION_REQUIRED');
  assert.equal((await mutate(a.account, '/auth/reauthenticate', { password: 'incorrect' })).payload.error.code, 'INVALID_CREDENTIALS');
  assert.equal((await session(a.account)).state, 'AUTHENTICATED');
  check(await mutate(a.account, '/auth/reauthenticate', { password: credentials.password }), 201, 'Reautentikasi');
  const expires = (await session(a.account)).expiresAt;
  check(await mutate(a.account, '/me/sessions/revoke-others'), 201, 'Cabut sesi lain');
  assert.equal((await session(other)).state, 'GUEST'); assert.equal((await session(a.account)).expiresAt, expires);
  check(await a.account.request(`/me/sessions/${otherMeta.sessionId}`, { method: 'DELETE' }), 200, 'Revokasi berulang');
  mark('fixed_expiry_activity_reauth_owned_sessions');
  const oldId = (await session(a.account)).sessionId;
  check(await mutate(a.account, '/auth/login', { email: b.email, password: credentials.password }), 201, 'Ganti akun browser');
  assert((await db.session.findUniqueOrThrow({ where: { id: oldId } })).revokedAt);
  assert.equal((await session(a.account)).user.id, b.id);
  check(await mutate(a.account, '/auth/logout'), 201, 'Logout'); check(await mutate(a.account, '/auth/logout'), 201, 'Logout ulang');
  const expired = await actor(); const expMeta = await session(expired.account);
  await db.session.update({ where: { id: expMeta.sessionId }, data: { expiresAt: new Date(Date.now() - 1) } });
  assert.equal((await expired.account.request('/me')).status, 401); assert.equal((await session(expired.account)).state, 'GUEST');
  check(await mutate(expired.account, '/auth/logout'), 201, 'Logout expired'); mark('identity_rotation_logout_expiry');
  const fresh = await actor(); const freshMeta = await session(fresh.account);
  await db.session.update({ where: { id: freshMeta.sessionId }, data: { reauthenticatedAt: new Date(Date.now() - 900001) } });
  assert.equal((await fresh.account.request('/me', { method: 'PATCH', body: { email: `changed-${randomUUID()}@demo.valora.local` } })).payload.error.code, 'REAUTHENTICATION_REQUIRED');
  assert.equal((await mutate(fresh.account, '/me/close')).payload.error.code, 'REAUTHENTICATION_REQUIRED');
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: fresh.id } })).status, 'ACTIVE');
  const limited = await actor();
  for (let i = 0; i < 7; i++) assert.equal((await mutate(limited.account, '/auth/reauthenticate', { password: 'wrong' })).status, 401);
  assert.equal((await mutate(limited.account, '/auth/reauthenticate', { password: credentials.password })).status, 429);
  mark('sensitive_actions_no_mutation_and_rate_limit');
  const loginLimit = await actor(); const csrfToken = check(await loginLimit.account.request('/auth/csrf'), 200, 'CSRF shared').token;
  const responses = await Promise.all(Array.from({ length: 9 }, (_, i) => fetch((i % 2 ? 'http://127.0.0.1:4004' : base) + '/api/v1/auth/login', { method: 'POST', headers: { Cookie: loginLimit.account.cookieHeader(), 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: loginLimit.email, password: 'wrong' }) })));
  assert(responses.filter((r) => r.status === 429).length >= 2); mark('shared_database_rate_limit');
  const reset = await actor(); const resetRaw = randomUUID() + randomUUID();
  await db.verificationToken.create({ data: { userId: reset.id, tokenHash: createHash('sha256').update(resetRaw).digest('hex'), purpose: 'PASSWORD_RESET', expiresAt: new Date(Date.now() + 60000) } });
  const again = client(); check(await again.request('/auth/csrf'), 200, 'CSRF race');
  const [resetResult, loginResult] = await Promise.all([mutate(reset.account, '/auth/password-reset/confirm', { token: resetRaw, password: 'Stage6-new-password-strong' }), mutate(again, '/auth/login', { email: reset.email, password: credentials.password })]);
  assert.equal(resetResult.status, 201); assert([201, 401].includes(loginResult.status));
  assert.equal(await db.session.count({ where: { userId: reset.id, revokedAt: null } }), 0); mark('login_against_password_reset');
  const race = await actor(); const revoker = await login(race.email); const raceSession = (await session(race.account)).sessionId;
  const [revoked, edited] = await Promise.all([revoker.request(`/me/sessions/${raceSession}`, { method: 'DELETE' }), race.account.request('/me', { method: 'PATCH', body: { displayName: 'Perubahan bersamaan' } })]);
  assert.equal(revoked.status, 200); assert([200, 401].includes(edited.status)); assert.equal((await race.account.request('/me')).status, 401); mark('revocation_against_mutation');
  const queued = await actor(); const queuedSession = (await session(queued.account)).sessionId;
  let releaseRevocation; let revocationEntered;
  const revokeReady = new Promise((r) => { revocationEntered = r; }); const revokeBarrier = new Promise((r) => { releaseRevocation = r; });
  const committingRevocation = db.$transaction(async (tx) => { await tx.$queryRaw`SELECT pg_advisory_xact_lock(610006)::text`; await tx.session.update({ where: { id: queuedSession }, data: { revokedAt: new Date() } }); revocationEntered(); await revokeBarrier; }, { timeout: 10000 });
  await revokeReady; const queuedEdit = queued.account.request('/me', { method: 'PATCH', body: { displayName: 'This edit must never commit' } }); await new Promise((r) => setTimeout(r, 200)); releaseRevocation(); await committingRevocation;
  assert.equal((await queuedEdit).status, 401); assert.equal((await db.user.findUniqueOrThrow({ where: { id: queued.id } })).displayName, queued.displayName); mark('queued_mutation_rechecks_committed_revocation');
  const streamActor = await actor();
  const stream = await fetch(base + '/api/v1/conversations/stream', { headers: { Cookie: streamActor.account.cookieHeader() } }); assert.equal(stream.status, 200);
  const reader = stream.body.getReader(); await mutate(streamActor.account, '/auth/logout');
  let timeout; const ended = (async () => { for (;;) { if ((await reader.read()).done) return true; } })();
  assert.equal(await Promise.race([ended, new Promise((r) => { timeout = setTimeout(() => r(false), 12000); })]), true); clearTimeout(timeout); mark('sse_revocation_closes_stream');
  // Replay has a private response; authorization must be checked before returning it.
  const fixtures = JSON.parse(await readFile(new URL("../../../../.local/stage5-test-fixtures.json", import.meta.url), 'utf8'));
  const correction = await db.correctionCase.findUniqueOrThrow({ where: { id: fixtures.correctedCase } });
  await db.correctionCase.update({ where: { id: correction.id }, data: { assignedAdminId: admin.id } });
  const replayKey = randomUUID(); const payload = { caseId: correction.id };
  const canonical = JSON.stringify({ caseId: correction.id });
  await db.idempotencyRequest.create({ data: { actorId: admin.id, operation: 'ownership-correction:' + correction.transactionId, key: replayKey, requestHash: createHash('sha256').update(canonical).digest('hex'), responseBody: { private: 'evidence-secret' } } });
  // Use the domain helper under a synthetic request context to exercise cached replay independently of DTO validation.
  const { requestContext } = await import('../../dist/shared/request-context.js'); const { idempotent } = await import('../../dist/shared/transactions.js');
  const adminMeta = await session(admin.account);
  await assert.rejects(requestContext.run({ actor: { id: admin.id, role: 'ADMIN', sessionId: adminMeta.sessionId, emailVerifiedAt: new Date() } }, () => idempotent(db, admin.id, 'ownership-correction:' + correction.transactionId, replayKey, payload, async () => { throw new Error('Replay reran action'); })), (e) => e.code === 'ACCESS_REASON_REQUIRED');
  await db.operationsAccessGrant.create({ data: { adminId: admin.id, scopeType: 'CORRECTION', scopeId: correction.id, reason: 'Synthetic replay authorization', expiresAt: new Date(Date.now() + 60000) } });
  const replay = await requestContext.run({ actor: { id: admin.id, role: 'ADMIN', sessionId: adminMeta.sessionId, emailVerifiedAt: new Date() } }, () => idempotent(db, admin.id, 'ownership-correction:' + correction.transactionId, replayKey, payload, async () => { throw new Error('Replay reran action'); }));
  assert.equal(replay.private, 'evidence-secret');
  const status = check(await mutate(admin.account, '/me/actions/status', { operation: 'ownership-correction:' + correction.transactionId, key: replayKey }), 201, 'Action status'); assert.deepEqual(Object.keys(status).sort(), ['completedAt', 'status']); assert.equal(status.status, 'COMMITTED');
  assert.equal(check(await mutate(b.account, '/me/actions/status', { operation: 'ownership-correction:' + correction.transactionId, key: replayKey }), 201, 'Foreign status').status, 'NOT_FOUND');
  await db.operationsAccessGrant.updateMany({ where: { adminId: admin.id, scopeId: correction.id }, data: { expiresAt: new Date(Date.now() - 1) } });
  await assert.rejects(requestContext.run({ actor: { id: admin.id, role: 'ADMIN', sessionId: adminMeta.sessionId, emailVerifiedAt: new Date() } }, () => idempotent(db, admin.id, 'ownership-correction:' + correction.transactionId, replayKey, payload, async () => null)), (e) => e.code === 'ACCESS_REASON_REQUIRED');
  mark('replay_current_grant_and_metadata_only_recovery');
  // A rubric publication and review share the policy gate; stale assessment never becomes active.
  const policyOwner = await actor(); const policyBuyer = await actor();
  const policyItem = await createItem(policyOwner.account, 'fashion', 'Race kebijakan tahap enam');
  const pendingListing = await createListing(policyOwner.account, policyItem.item, policyItem.assessment, seed.cityId, 'DONATE', policyItem.item.title);
  const rubricDraft = check(await mutate(admin.account, '/admin/rubrics/drafts', { baseVersionId: policyItem.assessment.rubricVersionId, reason: 'Fixture publikasi bersamaan dengan moderasi.' }), 201, 'Draft policy race');
  const [published, reviewed] = await Promise.all([
    mutate(admin.account, `/admin/rubrics/drafts/${rubricDraft.id}/publish`, { expectedVersion: rubricDraft.version, reason: 'Publikasi fixture race kebijakan dengan review.' }),
    mutate(admin.account, `/admin/listing-reviews/${pendingListing.currentRevision.id}/decide`, { expectedVersion: pendingListing.version, decision: 'APPROVE', reasonCode: 'STAGE6_POLICY', reasonText: 'Pemeriksaan bersamaan dengan perubahan kebijakan.', riskFlags: [] }),
  ]);
  assert.equal(published.status, 201); assert([201, 409, 422].includes(reviewed.status), JSON.stringify(reviewed.payload));
  assert.notEqual((await db.listing.findUniqueOrThrow({ where: { id: pendingListing.id } })).status, 'ACTIVE');
  mark('rubric_publication_against_moderation');
  const acceptedItem = await createItem(policyOwner.account, 'fashion', 'Race reservasi tahap enam');
  const activeListing = await approve(admin.account, await createListing(policyOwner.account, acceptedItem.item, acceptedItem.assessment, seed.cityId, 'DONATE', acceptedItem.item.title));
  const policyOffer = check(await mutate(policyBuyer.account, `/listings/${activeListing.id}/offers`, { clientRequestId: randomUUID(), expectedListingVersion: activeListing.version, listingRevisionId: activeListing.revision.id }), 201, 'Offer policy race');
  const nextDraft = check(await mutate(admin.account, '/admin/rubrics/drafts', { baseVersionId: acceptedItem.assessment.rubricVersionId, reason: 'Publikasi bersamaan dengan penerimaan Offer.' }), 201, 'Draft accept race');
  const [publishAccepted, acceptedResult] = await Promise.all([
    mutate(admin.account, `/admin/rubrics/drafts/${nextDraft.id}/publish`, { expectedVersion: nextDraft.version, reason: 'Menguji snapshot yang sudah disepakati saat publikasi.' }),
    mutate(policyOwner.account, `/offers/${policyOffer.id}/accept`, { expectedVersion: policyOffer.version, listingRevisionId: policyOffer.listingRevisionId, offerRevisionId: policyOffer.currentRevision.id }),
  ]);
  assert.equal(publishAccepted.status, 201); assert([201, 409, 422].includes(acceptedResult.status));
  const policyState = await db.item.findUniqueOrThrow({ where: { id: acceptedItem.item.id } });
  if (acceptedResult.status === 201) { assert.equal(policyState.reservedByTransactionId, acceptedResult.payload.data.id); assert.equal((await db.listing.findUniqueOrThrow({ where: { id: activeListing.id } })).status, 'RESERVED'); }
  else { assert.equal(policyState.reservedByTransactionId, null); assert.notEqual((await db.listing.findUniqueOrThrow({ where: { id: activeListing.id } })).status, 'ACTIVE'); }
  mark('rubric_publication_against_offer_acceptance');
  // Pagination includes records after the former 100-row cap.
  const reports = await db.report.createManyAndReturn({ data: Array.from({ length: 105 }, () => ({ reporterId: b.id, targetType: 'USER', targetId: fresh.id, reasonCode: 'STAGE6', details: 'Synthetic pagination fixture' })) });
  let cursor = null; const reached = new Set();
  do { const response = await admin.account.request('/admin/reports' + (cursor ? '?cursor=' + cursor : '')); check(response, 200, 'Report pagination'); response.payload.data.forEach((r) => reached.add(r.id)); cursor = response.payload.meta.nextCursor; } while (cursor);
  assert(reports.every((r) => reached.has(r.id))); mark('queue_pagination_after_100');
  let release; let entered;
  const held = new Promise((r) => { release = r; }); const started = new Promise((r) => { entered = r; });
  const first = exclusiveJob('stage6-proof', async () => { entered(); await held; return true; }); await started;
  assert.equal(await exclusiveJob('stage6-proof', async () => { throw new Error('Concurrent job ran'); }), undefined); release(); assert.equal(await first, true); mark('dedicated_connection_job_exclusion');
  const heldReport = await db.report.create({ data: { reporterId: b.id, targetType: 'USER', targetId: fresh.id, reasonCode: 'STAGE6_HOLD', details: 'Private held report must survive purge', status: 'RESOLVED', assignedAdminId: admin.id, resolvedAt: new Date(Date.now() - 181 * 86400000) } });
  let releaseHold; let holdEntered; const holdReady = new Promise((r) => { holdEntered = r; }); const holdBarrier = new Promise((r) => { releaseHold = r; });
  const committingHold = db.$transaction(async (tx) => { await tx.$queryRaw`SELECT pg_advisory_xact_lock(610006)::text`; await tx.retentionHold.create({ data: { scopeType: 'REPORT', scopeId: heldReport.id, adminId: admin.id, reason: 'Synthetic hold competing with purge', reviewAt: new Date(Date.now() + 86400000) } }); holdEntered(); await holdBarrier; }, { timeout: 10000 });
  await holdReady; const holdRetention = new RetentionService(db, new StorageService()); const pendingPurge = holdRetention.purge(); await new Promise((r) => setTimeout(r, 200)); releaseHold(); await committingHold; await pendingPurge;
  assert.equal((await db.report.findUniqueOrThrow({ where: { id: heldReport.id } })).details, heldReport.details); mark('queued_purge_rechecks_committed_hold');
  const mailId = randomUUID();
  // Config localRoot is the repo .local, independently of the process cwd.
  const { config } = await import('../../dist/infrastructure/config.js'); const directory = resolve(config.localRoot, 'mail'); await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, mailId + '.txt'), 'Synthetic expired mail');
  await db.mailOutbox.create({ data: { id: mailId, recipient: 'synthetic@invalid.valora.local', subject: 'Fixture', encryptedBody: '', expiresAt: new Date(Date.now() - 90000000), createdAt: new Date(Date.now() - 90000000), sentAt: new Date(Date.now() - 90000000) } });
  const storage = new StorageService(); const retention = new RetentionService(db, storage); const maintenance = new MaintenanceService(db, { cleanupOrphans: async () => {} }, { reminders: async () => {} }, retention);
  let removed = false;
  for (let i = 0; i < 60; i++) { await maintenance.run(); try { await access(resolve(directory, mailId + '.txt')); } catch { removed = true; break; } await new Promise((r) => setTimeout(r, 1000)); }
  assert(removed, 'Expired local mail eventually removed after the existing maintenance job finishes'); assert.equal(await db.mailOutbox.count({ where: { id: mailId } }), 0);
  await retention.purge(); const after = await retention.purge(); assert.equal(after.cases, 0); mark('durable_mail_cleanup_and_repeat_purge');
  await writeFile(new URL("../../../../.local/stage6-test-evidence.json", import.meta.url), JSON.stringify({ checks: counts, verifiedAt: new Date().toISOString() }, null, 2));
  console.log('Tahap 6 smoke lulus: ' + Object.keys(counts).join(', ') + '.');
} finally { second.kill(); await db.$disconnect(); }
