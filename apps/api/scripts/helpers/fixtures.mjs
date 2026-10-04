import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const base = process.env.VALORA_SMOKE_URL ?? 'http://127.0.0.1:4001';
export const credentials = JSON.parse(await readFile(new URL("../../../../.local/demo-credentials.json", import.meta.url), 'utf8'));
export const photo = await readFile(new URL("../../../web/public/images/keyboard.webp", import.meta.url));

export function client() {
  const cookies = new Map();
  let csrf = '';
  return {
    cookieHeader() { return [...cookies].map(([key, value]) => `${key}=${value}`).join('; '); },
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
export function check(result, expected, label) { assert.equal(result.status, expected, `${label}: ${JSON.stringify(result.payload)}`); return result.payload?.data; }
export async function login(email) {
  const account = client();
  check(await account.request('/auth/csrf'), 200, 'CSRF');
  check(await account.request('/auth/login', { method: 'POST', body: { email, password: credentials.password } }), 201, `Login ${email}`);
  return account;
}
export async function createItem(account, categoryCode, label) {
  const ticket = check(await account.request('/media/tickets', { method: 'POST', body: { fileName: 'demo-keyboard.webp', mime: 'image/webp', bytes: photo.length } }), 201, 'Tiket foto Item');
  check(await account.request(`/media/uploads/${ticket.ticketId}`, { method: 'PUT', body: photo, type: 'image/webp' }), 200, 'Unggah foto Item');
  const item = check(await account.request('/items', { method: 'POST', body: { title: label, description: `${label} masih bisa digunakan dan dirawat.`, categoryCode, conditionSummary: 'Terdapat bekas pemakaian ringan.', uploadTicketIds: [ticket.ticketId] } }), 201, 'Buat Item');
  const rubric = check(await account.request(`/categories/${categoryCode}/rubric`), 200, 'Rubrik kategori');
  const source = (amountIdr) => ({ amountIdr, sourceType: 'USER_ESTIMATE', sourceNote: 'Perkiraan pemilik untuk pengujian demo', referenceDate: '2026-09-30' });
  const assessment = check(await account.request(`/items/${item.id}/assessments`, { method: 'POST', body: {
    expectedItemRevision: item.itemRevision, rubricVersionId: rubric.id, contextAnswer: 'Barang rumah tangga dalam pemakaian normal', hasIssue: true, repairNeeded: true,
    answers: { function: 'LEVEL_75', physical: 'LEVEL_50', completeness: 'LEVEL_100', repairMethod: 'LEVEL_50', repairSupport: 'LEVEL_75', reuse: 'LEVEL_75' },
    safetyAnswers: Object.fromEntries(rubric.safetyQuestions.map(({ code }) => [code, 'TIDAK'])),
    economic: { estimatedResaleValue: source(450000), estimatedRepairCost: source(50000), comparableReplacementPrice: source(800000) },
  } }), 201, 'Assessment lengkap');
  assert.equal(assessment.status, 'COMPLETE');
  return { item, assessment };
}
export async function createListing(account, item, assessment, cityId, type, title) {
  const body = { assessmentId: assessment.id, expectedItemVersion: item.version, type, title, description: `${title} masih berfungsi dan siap dipakai kembali.`, mediaIds: item.media.map((entry) => entry.id), cityId, conditionDisclosure: 'Ada bekas pemakaian ringan yang terlihat pada foto.', handoverMethods: ['MEETUP'], ...(type === 'RESELL' ? { askingPriceIdr: 350000 } : type === 'EXCHANGE' ? { exchangePreference: 'Mencari barang sejenis dengan kondisi baik.' } : { recipientNote: 'Silakan gunakan kembali.' }) };
  const draft = check(await account.request(`/items/${item.id}/listings`, { method: 'POST', body }), 201, 'Buat Listing draft');
  assert.equal(draft.status, 'DRAFT');
  const submitted = check(await account.request(`/listings/${draft.id}/submit`, { method: 'POST', body: { expectedVersion: draft.version } }), 201, 'Ajukan Listing');
  assert.equal(submitted.status, 'PENDING_REVIEW');
  return submitted;
}
export async function approve(admin, listing, reason = 'Informasi Listing telah ditinjau.') {
  const queue = check(await admin.request('/admin/listing-reviews'), 200, 'Antrean moderasi');
  const row = queue.find((entry) => entry.listingId === listing.id);
  assert(row, 'Listing pending ada dalam antrean admin');
  const detail = check(await admin.request(`/admin/listing-reviews/${row.revisionId}`), 200, 'Detail review admin');
  assert.equal(detail.listingVersion, listing.version);
  assert.equal(detail.revision.media.length, 1);
  const privateAccess = check(await admin.request(`/media/${detail.revision.media[0].id}/access`), 200, 'Akses foto terbatas admin review');
  const photoResponse = await fetch(base + privateAccess.url, { headers: { Cookie: admin.cookieHeader() } });
  assert.equal(photoResponse.status, 200, 'Admin can fetch a signed photo while a revision is pending review');
  const body = { expectedVersion: detail.listingVersion, decision: 'APPROVE', reasonCode: 'REVIEW_PASSED', reasonText: reason, riskFlags: [] };
  const key = randomUUID();
  const result = check(await admin.request(`/admin/listing-reviews/${row.revisionId}/decide`, { method: 'POST', extraHeaders: { 'Idempotency-Key': key }, body }), 201, 'Setujui Listing');
  assert.equal(result.listingStatus, 'ACTIVE');
  const repeated = check(await admin.request(`/admin/listing-reviews/${row.revisionId}/decide`, { method: 'POST', extraHeaders: { 'Idempotency-Key': key }, body }), 201, 'Retry keputusan moderasi');
  assert.equal(repeated.reviewId, result.reviewId);
  const published = check(await admin.request(`/market/${listing.id}`), 200, 'Detail publik Listing aktif');
  const publicPhoto = await fetch(`${base}/api/v1/market/${listing.id}/media/${published.revision.media[0].id}`);
  assert.equal(publicPhoto.status, 200, 'Foto Listing dapat dibaca selama status aktif');
  assert.equal(publicPhoto.headers.get('content-type'), 'image/webp');
  return published;
}
