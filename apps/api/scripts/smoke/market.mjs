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
function check(result, expected, label) { assert.equal(result.status, expected, `${label}: ${JSON.stringify(result.payload)}`); return result.payload?.data; }
async function login(email) {
  const account = client();
  check(await account.request('/auth/csrf'), 200, 'CSRF');
  check(await account.request('/auth/login', { method: 'POST', body: { email, password: credentials.password } }), 201, `Login ${email}`);
  return account;
}
async function createItem(account, categoryCode, label) {
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
async function createListing(account, item, assessment, cityId, type, title) {
  const body = { assessmentId: assessment.id, expectedItemVersion: item.version, type, title, description: `${title} masih berfungsi dan siap dipakai kembali.`, mediaIds: item.media.map((entry) => entry.id), cityId, conditionDisclosure: 'Ada bekas pemakaian ringan yang terlihat pada foto.', handoverMethods: ['MEETUP'], ...(type === 'RESELL' ? { askingPriceIdr: 350000 } : type === 'EXCHANGE' ? { exchangePreference: 'Mencari barang sejenis dengan kondisi baik.' } : { recipientNote: 'Silakan gunakan kembali.' }) };
  const draft = check(await account.request(`/items/${item.id}/listings`, { method: 'POST', body }), 201, 'Buat Listing draft');
  assert.equal(draft.status, 'DRAFT');
  const submitted = check(await account.request(`/listings/${draft.id}/submit`, { method: 'POST', body: { expectedVersion: draft.version } }), 201, 'Ajukan Listing');
  assert.equal(submitted.status, 'PENDING_REVIEW');
  return submitted;
}
async function approve(admin, listing, reason = 'Informasi Listing telah ditinjau.') {
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

const owner = await login('owner.demo@valora.local');
const bidder = await login('member.demo@valora.local');
const admin = await login('admin.demo@valora.local');
const guest = client();
const ownerProfile = check(await owner.request('/me'), 200, 'Profil pemilik');
const spec = await fetch(base + '/api/docs-json').then((response) => response.json());
for (const path of ['/api/v1/market', '/api/v1/listings/{id}/submit', '/api/v1/offers/{id}/counter', '/api/v1/conversations/stream', '/api/v1/admin/listing-reviews/{revisionId}']) assert(spec.paths[path], `OpenAPI includes ${path}`);

const resellA = await createItem(owner, 'electronics', `Demo Resell ${randomUUID().slice(0, 5)}`);
const resellB = await createItem(owner, 'electronics', `Demo Resell kedua ${randomUUID().slice(0, 5)}`);
const exchange = await createItem(owner, 'electronics', `Demo Exchange ${randomUUID().slice(0, 5)}`);
const donate = await createItem(owner, 'electronics', `Demo Donate ${randomUUID().slice(0, 5)}`);
const otherItem = await createItem(bidder, 'electronics', `Barang tukar ${randomUUID().slice(0, 5)}`);
const resellListingA = await createListing(owner, resellA.item, resellA.assessment, ownerProfile.city.id, 'RESELL', resellA.item.title);
const resellListingB = await createListing(owner, resellB.item, resellB.assessment, ownerProfile.city.id, 'RESELL', resellB.item.title);
const exchangeListing = await createListing(owner, exchange.item, exchange.assessment, ownerProfile.city.id, 'EXCHANGE', exchange.item.title);
const donateListing = await createListing(owner, donate.item, donate.assessment, ownerProfile.city.id, 'DONATE', donate.item.title);
const publicA = await approve(admin, resellListingA);
const publicB = await approve(admin, resellListingB);
const publicExchange = await approve(admin, exchangeListing);
const publicDonate = await approve(admin, donateListing);
assert.equal(publicA.status, 'ACTIVE');
assert.equal(publicExchange.type, 'EXCHANGE');
assert.equal(publicDonate.type, 'DONATE');

const listingReport = check(await bidder.request('/reports', { method: 'POST', body: { targetType: 'LISTING', targetId: publicB.id, reasonCode: 'MISLEADING_CONTENT', details: 'Informasi Listing perlu diperiksa kembali oleh admin.' } }), 201, 'Laporkan Listing aktif');
const listingClaim = check(await admin.request(`/admin/reports/${listingReport.id}/claim`, { method: 'POST', extraHeaders: { 'Idempotency-Key': randomUUID() }, body: { expectedVersion: 1, reason: 'Meninjau laporan Listing sebagai admin kasus.' } }), 201, 'Ambil laporan Listing');
check(await admin.request(`/admin/reports/${listingReport.id}/access`, { method: 'POST', extraHeaders: { 'Idempotency-Key': randomUUID() }, body: { reason: 'Membaca konteks laporan Listing sebelum tindakan.' } }), 201, 'Akses privat laporan Listing');
check(await admin.request(`/admin/listings/${publicB.id}/suspend`, { method: 'POST', extraHeaders: { 'Idempotency-Key': randomUUID() }, body: { reportId: listingReport.id, expectedVersion: publicB.version, reason: 'Listing ditangguhkan sampai verifikasi selesai.' } }), 201, 'Tangguhkan Listing dari laporan');
assert.equal((await guest.request(`/market/${publicB.id}`)).status, 404, 'Listing suspended tidak tampil di Market');
check(await admin.request(`/admin/listings/${publicB.id}/release`, { method: 'POST', extraHeaders: { 'Idempotency-Key': randomUUID() }, body: { reportId: listingReport.id, expectedVersion: publicB.version + 1, reason: 'Pemeriksaan selesai; minta moderasi ulang.', withdraw: false } }), 201, 'Lepas Listing ke antrean review ulang');
const rereviewQueue = check(await admin.request('/admin/listing-reviews'), 200, 'Antrean review ulang');
const rereviewRow = rereviewQueue.find((entry) => entry.listingId === publicB.id);
assert(rereviewRow, 'Listing yang dilepas kembali masuk antrean review');
const rereviewDetail = check(await admin.request(`/admin/listing-reviews/${rereviewRow.revisionId}`), 200, 'Detail review ulang');
const rereviewBody = { expectedVersion: rereviewDetail.listingVersion, decision: 'APPROVE', reasonCode: 'REVIEW_PASSED', reasonText: 'Listing lolos pemeriksaan ulang.', riskFlags: [] };
const rereviewResult = check(await admin.request(`/admin/listing-reviews/${rereviewRow.revisionId}/decide`, { method: 'POST', extraHeaders: { 'Idempotency-Key': randomUUID() }, body: rereviewBody }), 201, 'Putuskan review ulang untuk revisi yang sama');
assert.equal(rereviewResult.listingStatus, 'ACTIVE');

const marketFirstResponse = await guest.request('/market?type=RESELL&sort=price_asc&limit=1');
check(marketFirstResponse, 200, 'Market dengan cursor harga');
assert.equal(marketFirstResponse.payload.data.length, 1);
assert(marketFirstResponse.payload.meta.nextCursor, 'Market returns next cursor');
const marketSecondResponse = await guest.request(`/market?type=RESELL&sort=price_asc&limit=1&cursor=${encodeURIComponent(marketFirstResponse.payload.meta.nextCursor)}`);
check(marketSecondResponse, 200, 'Market halaman berikutnya');
assert.equal(marketSecondResponse.payload.data.length, 1);
assert.notEqual(marketFirstResponse.payload.data[0].id, marketSecondResponse.payload.data[0].id, 'Price cursor preserves filters and tie-breaks');

const offerInput = { listingRevisionId: publicA.revision.id, expectedListingVersion: publicA.version, clientRequestId: randomUUID(), priceIdr: 300000, message: 'Apakah semua tombol berfungsi?' };
const offer = check(await bidder.request(`/listings/${publicA.id}/offers`, { method: 'POST', body: offerInput }), 201, 'Offer Resell');
const duplicateOffer = check(await bidder.request(`/listings/${publicA.id}/offers`, { method: 'POST', body: offerInput }), 201, 'Retry Offer dengan clientRequestId');
assert.equal(duplicateOffer.id, offer.id);
const ownerCounter = check(await owner.request(`/offers/${offer.id}/counter`, { method: 'POST', body: { expectedVersion: offer.version, priceIdr: 325000, message: 'Saya bisa melepas pada nominal ini.' } }), 201, 'Counteroffer pemilik');
const bidderCounter = check(await bidder.request(`/offers/${offer.id}/counter`, { method: 'POST', body: { expectedVersion: ownerCounter.version, priceIdr: 315000, message: 'Saya setuju mendekati nominal tersebut.' } }), 201, 'Counteroffer penawar');
assert.equal(bidderCounter.currentRevision.respondsById, ownerProfile.id);
const rejected = check(await owner.request(`/offers/${offer.id}/reject`, { method: 'POST', body: { expectedVersion: bidderCounter.version } }), 201, 'Tolak Offer');
assert.equal(rejected.status, 'REJECTED');
check(await bidder.request(`/offers/${offer.id}`), 200, 'Offer privat untuk penawar');
check(await admin.request(`/offers/${offer.id}`), 404, 'Offer privat untuk non-pihak');

const exchangeInput = { listingRevisionId: publicExchange.revision.id, expectedListingVersion: publicExchange.version, clientRequestId: randomUUID(), exchangeItemId: otherItem.item.id };
const exchangeOffer = check(await bidder.request(`/listings/${publicExchange.id}/offers`, { method: 'POST', body: exchangeInput }), 201, 'Offer Exchange memakai Item layak');
assert.equal(exchangeOffer.exchangeItemId, otherItem.item.id);
const donateInput = { listingRevisionId: publicDonate.revision.id, expectedListingVersion: publicDonate.version, clientRequestId: randomUUID(), message: 'Saya ingin menerima barang ini.' };
const donateOffer = check(await bidder.request(`/listings/${publicDonate.id}/offers`, { method: 'POST', body: donateInput }), 201, 'Offer Donate tanpa harga');
assert.equal(donateOffer.currentRevision.priceIdr, null);

const unreadBefore = check(await owner.request('/conversations/unread-count'), 200, 'Unread awal fixture').count;
const conversation = check(await bidder.request(`/listings/${publicA.id}/conversations`, { method: 'POST' }), 201, 'Buka percakapan');
const sameConversation = check(await bidder.request(`/listings/${publicA.id}/conversations`, { method: 'POST' }), 201, 'Percakapan unik per Listing/peserta');
assert.equal(sameConversation.id, conversation.id);
const messageInput = { clientMessageId: randomUUID(), body: 'Boleh saya melihat foto sisi belakang?' };
const message = check(await bidder.request(`/conversations/${conversation.id}/messages`, { method: 'POST', body: messageInput }), 201, 'Kirim pesan');
const repeatedMessage = check(await bidder.request(`/conversations/${conversation.id}/messages`, { method: 'POST', body: messageInput }), 201, 'Retry pesan idempoten');
assert.equal(repeatedMessage.id, message.id);
const ownerConversations = check(await owner.request('/conversations'), 200, 'Daftar percakapan pemilik');
assert.equal(ownerConversations.find((entry) => entry.id === conversation.id).unreadCount, 1);
check(await owner.request(`/conversations/${conversation.id}/read`, { method: 'POST', body: { throughSequence: message.sequence } }), 201, 'Tandai pesan dibaca');
assert.equal(check(await owner.request('/conversations/unread-count'), 200, 'Unread count').count, unreadBefore);
check(await admin.request(`/conversations/${conversation.id}/messages`), 404, 'Histori pesan privat');
const report = check(await owner.request('/reports', { method: 'POST', body: { targetType: 'MESSAGE', targetId: message.id, reasonCode: 'PERSONAL_DATA', details: 'Pesan meminta data pribadi yang tidak diperlukan.' } }), 201, 'Laporkan pesan');
const adminReports = []; let reportCursor = null;
do { const response = await admin.request('/admin/reports' + (reportCursor ? '?cursor=' + reportCursor : '')); adminReports.push(...check(response, 200, 'Antrean laporan admin')); reportCursor = response.payload.meta?.nextCursor; } while (reportCursor);
assert(adminReports.some((entry) => entry.id === report.id));
const messageClaim = check(await admin.request(`/admin/reports/${report.id}/claim`, { method: 'POST', extraHeaders: { 'Idempotency-Key': randomUUID() }, body: { expectedVersion: 1, reason: 'Meninjau laporan pesan terkait.' } }), 201, 'Ambil laporan pesan');
check(await admin.request(`/admin/reports/${report.id}/access`, { method: 'POST', extraHeaders: { 'Idempotency-Key': randomUUID() }, body: { reason: 'Memeriksa laporan pesan terkait sebelum putusan.' } }), 201, 'Buka akses laporan pesan');
check(await admin.request(`/admin/reports/${report.id}/resolve`, { method: 'POST', extraHeaders: { 'Idempotency-Key': randomUUID() }, body: { expectedVersion: messageClaim.version, decision: 'RESOLVED', reason: 'Laporan ditinjau dan dicatat.' } }), 201, 'Selesaikan laporan');

const expiringOffer = check(await bidder.request(`/listings/${publicA.id}/offers`, { method: 'POST', body: { ...offerInput, clientRequestId: randomUUID() } }), 201, 'Offer kedua untuk uji jeda Listing');
const changedItem = check(await owner.request(`/items/${resellA.item.id}`, { method: 'PATCH', body: { expectedVersion: resellA.item.version, description: 'Deskripsi berubah sehingga penilaian lama harus diperbarui.' } }), 200, 'Perubahan Item material');
assert.equal(changedItem.itemRevision, resellA.item.itemRevision + 1);
const paused = check(await owner.request(`/listings/${publicA.id}`), 200, 'Listing privat setelah perubahan Item');
assert.equal(paused.status, 'PAUSED');
const expired = check(await bidder.request(`/offers/${expiringOffer.id}`), 200, 'Offer setelah Item berubah');
assert.equal(expired.status, 'EXPIRED');
assert.equal(expired.endReason, 'LISTING_REVISED');
check(await guest.request(`/market/${publicA.id}`), 404, 'Listing jeda tidak tampil di Market');
assert.equal((await guest.request(`/market/${publicA.id}/media/${publicA.revision.media[0].id}`)).status, 404, 'Foto publik tidak lagi tersedia setelah Listing dijeda');
check(await owner.request(`/conversations/${conversation.id}/messages`), 200, 'Histori tetap tersedia setelah Listing jeda');

console.log('Tahap 3 smoke lulus: Market/cursor/foto, tiga tipe Listing, review ulang, Offer/counter, privasi chat, unread, laporan, dan pause saat Item berubah.');
