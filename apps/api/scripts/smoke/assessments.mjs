import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.VALORA_SMOKE_URL ?? 'http://127.0.0.1:4001';
const credentials = JSON.parse(await readFile(resolve(process.cwd(), '../../.local/demo-credentials.json'), 'utf8'));
const photo = await readFile(resolve(process.cwd(), '../web/public/images/keyboard.webp'));

function client() {
  const cookies = new Map();
  let csrf = '';
  return {
    async request(path, { method = 'GET', body, type, extraHeaders = {} } = {}) {
      const headers = { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...extraHeaders };
      if (method !== 'GET' && method !== 'HEAD') headers['X-CSRF-Token'] = csrf;
      if (body !== undefined) headers['Content-Type'] = type ?? 'application/json';
      const response = await fetch(base + '/api/v1' + path, { method, headers, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
      for (const raw of response.headers.getSetCookie()) { const first = raw.split(';')[0]; const split = first.indexOf('='); cookies.set(first.slice(0, split), first.slice(split + 1)); }
      const payload = (response.headers.get('content-type') ?? '').includes('application/json') ? await response.json() : null;
      if (path === '/auth/csrf' && response.ok) csrf = payload.data.token;
      return { status: response.status, payload };
    },
  };
}
function check(result, expected, label) { assert.equal(result.status, expected, `${label}: ${JSON.stringify(result.payload)}`); return result.payload?.data; }
async function login(email) {
  const account = client();
  check(await account.request('/auth/csrf'), 200, 'CSRF');
  check(await account.request('/auth/login', { method: 'POST', body: { email, password: credentials.password } }), 201, 'Login demo');
  return account;
}
async function upload(account, itemId, purpose = 'ITEM') {
  const route = itemId ? `/items/${itemId}/media/tickets` : '/media/tickets';
  const ticket = check(await account.request(route, { method: 'POST', body: { fileName: 'keyboard.webp', mime: 'image/webp', bytes: photo.length, purpose } }), 201, 'Tiket foto');
  check(await account.request(`/media/uploads/${ticket.ticketId}`, { method: 'PUT', body: photo, type: 'image/webp' }), 200, 'Unggah foto');
  return ticket.ticketId;
}
const owner = await login('owner.demo@valora.local');
const other = await login('member.demo@valora.local');
const rubric = check(await owner.request('/categories/electronics/rubric'), 200, 'Rubrik publik');
assert.equal(rubric.questions.length, 6);
assert.equal(rubric.safetyQuestions.length, 3);
const apiSpec = await fetch(base + '/api/docs-json').then((response) => response.json());
assert(apiSpec.paths['/api/v1/items/{itemId}/assessments']);
assert(apiSpec.paths['/api/v1/items/{itemId}/repairs']);

const firstTicket = await upload(owner);
const item = check(await owner.request('/items', { method: 'POST', body: { title: 'Keyboard mekanis uji', description: 'Keyboard masih dapat digunakan dengan beberapa kendala.', categoryCode: 'electronics', conditionSummary: 'Sebelum Repair', uploadTicketIds: [firstTicket] } }), 201, 'Buat Item');
const source = (amountIdr) => ({ amountIdr, sourceType: 'USER_ESTIMATE', sourceNote: 'Perkiraan pemilik berdasarkan kondisi barang', referenceDate: '2026-09-28' });
const input = { expectedItemRevision: item.itemRevision, rubricVersionId: rubric.id, contextAnswer: 'Keyboard listrik tanpa baterai', hasIssue: true, repairNeeded: true,
  answers: { function: 'LEVEL_75', physical: 'LEVEL_50', completeness: 'LEVEL_100', repairMethod: 'LEVEL_50', repairSupport: 'LEVEL_75', reuse: 'LEVEL_75' },
  safetyAnswers: Object.fromEntries(rubric.safetyQuestions.map(({ code }) => [code, 'TIDAK'])),
  economic: { estimatedResaleValue: source(450000), estimatedRepairCost: source(50000), comparableReplacementPrice: source(800000) } };

const partial = check(await owner.request(`/items/${item.id}/assessments`, { method: 'POST', body: { ...input, economic: {} } }), 201, 'Assessment ekonomi parsial');
assert.equal(partial.status, 'PARTIAL_ECONOMIC'); assert.equal(partial.score, null);
assert.equal(partial.recommendations.find((entry) => entry.action === 'RESELL').status, 'NEEDS_DATA');
const unknown = check(await owner.request(`/items/${item.id}/assessments`, { method: 'POST', body: { ...input, safetyAnswers: { ...input.safetyAnswers, battery_or_wire: 'TIDAK_TAHU' } } }), 201, 'Keselamatan belum diketahui');
assert.equal(unknown.status, 'INCOMPLETE'); assert.equal(unknown.score, null);
const unsafe = check(await owner.request(`/items/${item.id}/assessments`, { method: 'POST', body: { ...input, safetyAnswers: { ...input.safetyAnswers, battery_or_wire: 'YA' } } }), 201, 'Kondisi terlarang');
assert.equal(unsafe.status, 'COMPLETE'); assert(unsafe.recommendations.every((entry) => entry.status === 'INELIGIBLE'));
check(await owner.request(`/items/${item.id}/assessments`, { method: 'POST', body: { ...input, economic: { ...input.economic, comparableReplacementPrice: source(0) } } }), 400, 'Pembanding nol ditolak');
const complete = check(await owner.request(`/items/${item.id}/assessments`, { method: 'POST', body: input }), 201, 'Assessment lengkap');
assert.equal(complete.score, 72); assert.equal(complete.label, 'High Circular Potential');
assert.equal(complete.isCurrent, true);
const newer = check(await owner.request(`/items/${item.id}/assessments`, { method: 'POST', body: input }), 201, 'Penilaian ulang pada revisi sama');
assert.equal(newer.isCurrent, true);
assert.equal(check(await owner.request(`/assessments/${complete.id}`), 200, 'Penilaian lama pada revisi sama').isCurrent, false);
check(await other.request(`/assessments/${complete.id}`), 404, 'Penilaian privat');
check(await other.request(`/items/${item.id}/assessments`), 404, 'Riwayat privat');

const titleOnly = check(await owner.request(`/items/${item.id}`, { method: 'PATCH', body: { expectedVersion: item.version, title: 'Keyboard mekanis terawat' } }), 200, 'Edit judul');
assert.equal(titleOnly.itemRevision, item.itemRevision);
assert.equal(check(await owner.request(`/assessments/${newer.id}`), 200, 'Assessment tetap terkini').isCurrent, true);
const evidenceTicket = await upload(owner, item.id, 'REPAIR_EVIDENCE');
const repair = check(await owner.request(`/items/${item.id}/repairs`, { method: 'POST', body: {
  expectedItemVersion: titleOnly.version, performedAt: new Date(Date.now() - 60_000).toISOString(), actionSummary: 'Mengganti stabilizer rusak', privateNotes: 'Bagian lama disimpan', costIdr: 85000, costKind: 'ACTUAL', outcome: 'SUCCEEDED', afterCondition: 'Stabilizer telah diganti', shareSummaryPublic: false, shareDetailsWithFutureOwner: false, evidenceTicketIds: [evidenceTicket],
} }), 201, 'Catat Repair');
assert.equal(repair.evidence.length, 1);
assert.equal(check(await owner.request(`/items/${item.id}`), 200, 'Item setelah Repair').media.length, 1, 'Bukti bukan galeri Item');
assert.equal(check(await owner.request(`/assessments/${newer.id}`), 200, 'Assessment historis').isCurrent, false);
check(await other.request(`/items/${item.id}/repairs`), 404, 'Riwayat Repair privat');
check(await other.request(`/media/${repair.evidence[0].id}/access`), 404, 'Bukti Repair privat');
check(await owner.request(`/media/${repair.evidence[0].id}/access`), 200, 'Pembuat melihat bukti');
check(await other.request(`/repairs/${repair.id}/corrections`, { method: 'POST', extraHeaders: { 'Idempotency-Key': randomUUID() }, body: { expectedVersion: 1, reason: 'Bukan pembuat', actionSummary: 'Perubahan tidak sah' } }), 404, 'Koreksi owner lain');
const correctionKey = randomUUID();
const correctionBody = { expectedVersion: 1, reason: 'Memperjelas tindakan', actionSummary: 'Mengganti dua stabilizer rusak' };
const corrected = check(await owner.request(`/repairs/${repair.id}/corrections`, { method: 'POST', extraHeaders: { 'Idempotency-Key': correctionKey }, body: correctionBody }), 201, 'Koreksi Repair');
assert.equal(corrected.version, 2);
assert.deepEqual(check(await owner.request(`/repairs/${repair.id}/corrections`, { method: 'POST', extraHeaders: { 'Idempotency-Key': correctionKey }, body: correctionBody }), 201, 'Retry koreksi'), corrected);
check(await owner.request(`/repairs/${repair.id}/corrections`, { method: 'POST', extraHeaders: { 'Idempotency-Key': correctionKey }, body: { ...correctionBody, reason: 'Alasan lain' } }), 409, 'Kunci koreksi tidak boleh beda payload');
check(await owner.request(`/repairs/${repair.id}/void`, { method: 'POST', extraHeaders: { 'Idempotency-Key': randomUUID() }, body: { expectedVersion: 1, reason: 'Salah catat tindakan' } }), 409, 'Versi lama ditolak');
const voidKey = randomUUID();
const voidBody = { expectedVersion: 2, reason: 'Salah catat tindakan' };
const voided = check(await owner.request(`/repairs/${repair.id}/void`, { method: 'POST', extraHeaders: { 'Idempotency-Key': voidKey }, body: voidBody }), 201, 'Void Repair');
assert.equal(voided.status, 'VOID');
assert.deepEqual(check(await owner.request(`/repairs/${repair.id}/void`, { method: 'POST', extraHeaders: { 'Idempotency-Key': voidKey }, body: voidBody }), 201, 'Retry void'), voided);
check(await owner.request(`/repairs/${repair.id}/void`, { method: 'POST', extraHeaders: { 'Idempotency-Key': randomUUID() }, body: { expectedVersion: 3, reason: 'Ulangi void' } }), 409, 'Void ganda ditolak');

const hobbyTicket = await upload(owner);
const hobby = check(await owner.request('/items', { method: 'POST', body: { title: 'Barang hobi uji', description: 'Barang hobi yang subkategorinya belum dipilih.', categoryCode: 'hobby', subcategoryCode: null, uploadTicketIds: [hobbyTicket] } }), 201, 'Draft Hobi tanpa subkategori');
check(await owner.request(`/items/${hobby.id}/assessments`, { method: 'POST', body: { ...input, expectedItemRevision: hobby.itemRevision } }), 422, 'Hobi tanpa rubrik tertahan');
console.log('Stage 2 smoke passed: rubric, Score states, safety, privacy, Repair evidence, correction, void, stale revision, hobby draft.');
