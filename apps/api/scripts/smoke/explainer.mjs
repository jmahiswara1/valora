import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { fork } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../dist/generated/prisma/client.js';
import { AssessmentsService } from '../../dist/modules/assessments/service.js';
import { ExplainerService } from '../../dist/modules/assessments/explainer.service.js';
import { requestContext } from '../../dist/shared/request-context.js';
import { nextWibDay } from '../../dist/modules/assessments/explainer/config.js';
import { handoverActors } from '../helpers/handover.mjs';
import { createItem, check, client, base } from '../helpers/fixtures.mjs';
if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Explainer requires test database.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const service = new ExplainerService(new AssessmentsService(db), db);
const hash = value => createHash('sha256').update(value).digest('hex');
let calls = 0, mode = 'valid', release = () => {}, waiting = Promise.resolve(); const payloads = [];
const server = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += String(chunk);
  const body = JSON.parse(raw); calls++; payloads.push(body); const input = JSON.parse(body.messages[1].content);
  assert.equal(req.url, '/v1/chat/completions'); assert.equal(body.model, 'ag/gemini-3.8-flash-high'); assert.equal(body.stream, false);
  if (mode === 'hold') await waiting;
  if (mode === 'timeout') return;
  if (mode === 'unavailable') { res.statusCode = 503; res.end(); return; }
  const output = { facts: input.facts, summary: 'Penilaian memberikan gambaran penggunaan kembali berdasarkan laporan pengguna.',
    strengths: ['Komponen yang telah dinilai membantu meninjau kondisi barang.'], limitations: ['Laporan pengguna belum menggantikan pemeriksaan fisik.'],
    actions: input.actions.map(a => ({ ...a, explanation: ({ ELIGIBLE: 'Dapat dipertimbangkan.', NEEDS_DATA: 'Perlu data.', INELIGIBLE: 'Belum layak.' })[a.status] + ' Perhatikan alasan penilaian.' })), nextSteps: ['Periksa kondisi sebelum serah terima.'] };
  if (mode === 'invalid') output.facts.score = 100;
  res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] }));
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
Object.assign(process.env, { AI_EXPLAINER_ENABLED: 'true', AI_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`, AI_API_KEY: 'test-key-only', AI_MODEL: 'ag/gemini-3.8-flash-high', AI_TIMEOUT_MS: '1500', AI_USER_DAILY_LIMIT: '20', AI_APP_DAILY_LIMIT: '200' });
const sleep = ms => new Promise(done => setTimeout(done, ms));
async function until(checker) { for (let i = 0; i < 200; i++) { if (checker()) return; await sleep(25); } throw new Error('Mock call not reached'); }
function hold() { mode = 'hold'; waiting = new Promise(done => { release = done; }); }
function worker(actor, id) {
  const child = fork(new URL('../helpers/explainer-worker.mjs', import.meta.url), [], { env: process.env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  return new Promise((resolve, reject) => { child.once('message', resolve); child.once('error', reject); child.once('exit', code => { if (code) reject(new Error('Worker exited')); }); child.send({ actor, id }); });
}
let fixtures = [], actors;
try {
  actors = await handoverActors(db);
  for (let i = 0; i < 4; i++) fixtures.push(await createItem(actors.owner.account, 'electronics', 'Penilaian AI sintetis ' + i));
  const session = await db.session.findFirstOrThrow({ where: { userId: actors.owner.user.id, revokedAt: null } });
  const actor = { id: actors.owner.user.id, sessionId: session.id, role: 'USER', emailVerifiedAt: new Date() };
  const actorId = actor.id, ids = fixtures.map(f => f.assessment.id);
  const explain = (index = 0, ctx = actor) => requestContext.run({ actor: ctx }, () => service.get(ctx.id, ids[index]));
  const dailyUser = hash('explanation:daily:user:' + actorId), dailyApp = hash('explanation:daily:app'), minute = hash('explanation:minute:' + actorId);
  async function reset() {
    await db.explanationCache.deleteMany({ where: { assessmentId: { in: ids } } }); await db.explanationLease.deleteMany({ where: { assessmentId: { in: ids } } });
    await db.authRateBucket.deleteMany({ where: { key: { in: [dailyUser, dailyApp, minute] } } }); mode = 'valid'; calls = 0;
    process.env.AI_USER_DAILY_LIMIT = '20'; process.env.AI_APP_DAILY_LIMIT = '200'; process.env.AI_TIMEOUT_MS = '1500';
  }
  const anonymous = client(); await anonymous.request('/auth/csrf');
  check(await anonymous.request(`/assessments/${ids[0]}/explain`, { method: 'POST' }), 401, 'Anonymous explanation');
  check(await actors.outsider.account.request(`/assessments/${ids[0]}/explain`, { method: 'POST' }), 404, 'Explanation privacy');
  const csrf = await fetch(base + `/api/v1/assessments/${ids[0]}/explain`, { method: 'POST', headers: { Cookie: actors.owner.account.cookieHeader() } }); assert.equal(csrf.status, 403);
  process.env.AI_EXPLAINER_ENABLED = 'false'; assert.equal((await explain()).fallbackReason, 'DISABLED');
  process.env.AI_EXPLAINER_ENABLED = 'true'; process.env.AI_API_KEY = ''; assert.equal((await explain()).fallbackReason, 'NOT_CONFIGURED'); assert.equal(calls, 0); process.env.AI_API_KEY = 'test-key-only';
  await reset(); const first = await explain(); assert.equal(first.source, 'AI'); assert.equal(first.cached, false);
  const cached = await explain(); assert.equal(cached.cached, true); assert.equal(calls, 1);
  assert.equal((await db.authRateBucket.findUniqueOrThrow({ where: { key: dailyUser } })).count, 1);
  assert.equal(Date.parse(first.expiresAt) - Date.parse(first.generatedAt), 86400000);
  await db.explanationCache.updateMany({ where: { assessmentId: ids[0] }, data: { expiresAt: new Date(0) } }); assert.equal((await explain()).source, 'AI'); assert.equal(calls, 2);
  const privateInput = await db.assessment.findUniqueOrThrow({ where: { id: ids[0] } });
  const sent = JSON.stringify(payloads);
  for (const secret of [actorId, ids[0], fixtures[0].item.id, privateInput.answersSnapshot.contextAnswer, 'sourceNote', 'reportedBy', 'economicSources', 'mediaIds', 'displayName']) assert(!sent.includes(secret), 'Private fields are excluded');
  await reset(); hold(); const before = calls;
  const shared = [worker(actor, ids[0]), worker(actor, ids[0])]; await until(() => calls > before); await sleep(150); release();
  const joined = await Promise.all(shared); assert(joined.every(r => r.source === 'AI')); assert.equal(calls, 1);
  assert.equal((await db.authRateBucket.findUniqueOrThrow({ where: { key: dailyUser } })).count, 1);
  await reset(); hold(); const two = [explain(0), explain(1)]; await until(() => calls === 2);
  const busy = await explain(2); assert.equal(busy.fallbackReason, 'BUSY'); assert.equal(calls, 2); release(); await Promise.all(two); assert.equal(await db.explanationLease.count(), 0);
  await reset(); process.env.AI_USER_DAILY_LIMIT = '1'; assert.equal((await explain(0)).source, 'AI'); assert.equal((await explain(1)).fallbackReason, 'USER_QUOTA'); assert.equal(calls, 1); assert.equal((await explain(0)).source, 'AI');
  const day = await db.authRateBucket.findUniqueOrThrow({ where: { key: dailyUser } }); assert.equal(day.resetAt.toISOString(), nextWibDay(new Date()).toISOString());
  await db.authRateBucket.update({ where: { key: dailyUser }, data: { resetAt: new Date(0) } }); assert.equal((await explain(1)).source, 'AI');
  await reset(); process.env.AI_APP_DAILY_LIMIT = '1'; await explain(0); assert.equal((await explain(1)).fallbackReason, 'APP_QUOTA'); assert.equal(calls, 1);
  await reset(); process.env.AI_USER_DAILY_LIMIT = '1'; hold();
  const quotaRace = [explain(0), explain(1)]; await until(() => calls === 1); await sleep(100); release();
  const quotaResults = await Promise.all(quotaRace); assert.equal(quotaResults.filter(r => r.source === 'AI').length, 1); assert.equal(quotaResults.filter(r => r.fallbackReason === 'USER_QUOTA').length, 1); assert.equal((await db.authRateBucket.findUniqueOrThrow({ where: { key: dailyApp } })).count, 1);
  await reset(); mode = 'invalid'; const invalid = await explain(); assert.equal(invalid.fallbackReason, 'INVALID_OUTPUT'); assert.equal((await explain()).cached, true); assert.equal(calls, 1);
  assert.equal(Date.parse(invalid.expiresAt) - Date.parse(invalid.generatedAt), 30000); assert(invalid.retryAt);
  await db.explanationCache.updateMany({ where: { assessmentId: ids[0] }, data: { expiresAt: new Date(0) } }); mode = 'valid'; assert.equal((await explain()).source, 'AI');
  await reset(); mode = 'timeout'; process.env.AI_TIMEOUT_MS = '80'; assert.equal((await explain()).fallbackReason, 'TIMEOUT'); assert.equal(calls, 1); assert.equal(await db.explanationLease.count(), 0);
  await reset(); mode = 'unavailable'; assert.equal((await explain()).fallbackReason, 'UPSTREAM_UNAVAILABLE'); assert.equal(calls, 1);
  await reset(); hold(); const changed = explain(); await until(() => calls === 1); await db.assessment.update({ where: { id: ids[0] }, data: { version: { increment: 1 }, valid: false } }); release();
  await assert.rejects(changed, error => error.code === 'STATE_CONFLICT'); assert.equal(await db.explanationCache.count({ where: { assessmentId: ids[0] } }), 0); assert.equal(await db.explanationLease.count(), 0);
  await reset(); hold(); const revoked = explain(1); await until(() => calls === 1); await db.session.update({ where: { id: actor.sessionId }, data: { revokedAt: new Date() } }); release();
  await assert.rejects(revoked, error => error.code === 'UNAUTHENTICATED'); assert.equal(await db.explanationCache.count({ where: { assessmentId: ids[1] } }), 0); assert.equal(await db.explanationLease.count(), 0);
  await db.session.update({ where: { id: actor.sessionId }, data: { revokedAt: null } });
  await reset(); hold(); const suspended = explain(1); await until(() => calls === 1); await db.user.update({ where: { id: actorId }, data: { status: 'SUSPENDED' } }); release(); await assert.rejects(suspended, error => error.code === 'ACCOUNT_SUSPENDED'); assert.equal(await db.explanationLease.count(), 0); await db.user.update({ where: { id: actorId }, data: { status: 'ACTIVE' } });
  await reset(); const { explainerConfig } = await import('../../dist/modules/assessments/explainer/config.js'); const expiredSnapshot = await service.snapshot(db, actorId, ids[1], explainerConfig());
  await db.explanationLease.create({ data: { key: expiredSnapshot.key, token: actor.sessionId, actorId, assessmentId: ids[1], expiresAt: new Date(0) } }); assert.equal((await explain(1)).source, 'AI'); assert.equal(await db.explanationLease.count(), 0);
  await reset(); hold(); const transferred = explain(2); await until(() => calls === 1); await db.item.update({ where: { id: fixtures[2].item.id }, data: { currentOwnerId: actors.buyer.user.id } }); release(); await assert.rejects(transferred, error => error.code === 'STATE_CONFLICT');
  const buyerSession = await db.session.findFirstOrThrow({ where: { userId: actors.buyer.user.id, revokedAt: null } });
  const buyer = { ...actor, id: actors.buyer.user.id, sessionId: buyerSession.id };
  mode = 'valid'; const historical = await explain(2, buyer); assert.equal(historical.historical, true); assert.equal(historical.source, 'AI');
  hold(); calls = 0; const accessLost = explain(3); await until(() => calls === 1); await db.assessment.update({ where: { id: ids[3] }, data: { createdById: actors.buyer.user.id } }); await db.item.update({ where: { id: fixtures[3].item.id }, data: { currentOwnerId: actors.buyer.user.id } }); release(); await assert.rejects(accessLost, error => error.code === 'NOT_FOUND');
  await reset(); for (let i = 0; i < 10; i++) await explain(1); await assert.rejects(explain(1), error => error.code === 'RATE_LIMITED'); assert.equal(calls, 1);
  console.log('AI Explainer smoke passed: ACL/CSRF, configuration, privacy, TTL, cross-process deduplication, global concurrency, daily quotas/WIB, cooldown, timeout, snapshot, session and ownership races, rate limit.');
} finally {
  release(); server.closeAllConnections(); await new Promise(done => server.close(done));
  await db.explanationLease.deleteMany({ where: { assessmentId: { in: fixtures.map(f => f.assessment.id) } } }); await db.$disconnect();
}
