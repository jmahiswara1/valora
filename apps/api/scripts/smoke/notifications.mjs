import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../dist/generated/prisma/client.js';
import { NotificationService } from '../../dist/modules/notifications/service.js';
import { base, client, check, credentials, login, createItem, createListing, approve } from '../helpers/fixtures.mjs';

if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Notifikasi membutuhkan database test.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const seed = await db.user.findUniqueOrThrow({ where: { email: 'owner.demo@valora.local' } });
async function actor(verified = true, role = 'USER') {
  const user = await db.user.create({ data: { email: `notifications-${randomUUID()}@demo.valora.local`, displayName: 'Fixture Notifikasi', cityId: seed.cityId, passwordHash: seed.passwordHash, emailVerifiedAt: verified ? new Date() : null, role } });
  return { user, account: await login(user.email) };
}
const mutate = (account, path, body, key = randomUUID()) => account.request(path, { method: 'POST', body, extraHeaders: { 'Idempotency-Key': key } });
let trigger = false;
try {
  const owner = await actor(), bidder = await actor(), other = await actor(false), admin = await actor(true, 'ADMIN');
  async function listing(type = 'RESELL') {
    const { item, assessment } = await createItem(owner.account, 'electronics', `Notifikasi ${randomUUID().slice(0, 8)}`);
    return approve(admin.account, await createListing(owner.account, item, assessment, seed.cityId, type, item.title));
  }
  const f = await listing();
  const body = { expectedListingVersion: f.version, listingRevisionId: f.revision.id, clientRequestId: randomUUID(), priceIdr: 200000, message: 'Pesan privat tidak boleh masuk ke pusat notifikasi.' };
  // Inject a failure only for this synthetic listing: the offer must roll back with its notification.
  await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION notification_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.payload->>'title' = TG_ARGV[0] THEN RAISE EXCEPTION 'notification rollback injection'; END IF; RETURN NEW; END $$`);
  assert.match(f.revision.title, /^Notifikasi [a-f0-9]{8}$/);
  await db.$executeRawUnsafe(`CREATE TRIGGER notification_failure BEFORE INSERT ON "InAppNotification" FOR EACH ROW EXECUTE FUNCTION notification_test_failure('${f.revision.title}')`); trigger = true;
  check(await mutate(bidder.account, `/listings/${f.id}/offers`, body), 500, 'Gagal notifikasi menggagalkan domain');
  assert.equal(await db.offer.count({ where: { clientRequestId: body.clientRequestId } }), 0);
  assert.equal(await db.inAppNotification.count({ where: { userId: owner.user.id } }), 0);
  await db.$executeRawUnsafe('DROP TRIGGER notification_failure ON "InAppNotification"'); trigger = false;
  let offer = check(await mutate(bidder.account, `/listings/${f.id}/offers`, body), 201, 'Penawaran masuk');
  check(await mutate(bidder.account, `/listings/${f.id}/offers`, body), 201, 'Retry penawaran');
  assert.equal(await db.inAppNotification.count({ where: { userId: owner.user.id, type: 'OFFER_RECEIVED' } }), 1);
  assert.equal(await db.inAppNotification.count({ where: { userId: bidder.user.id } }), 0);
  offer = check(await mutate(owner.account, `/offers/${offer.id}/counter`, { expectedVersion: offer.version, priceIdr: 250000 }), 201, 'Counter');
  assert.equal(await db.inAppNotification.count({ where: { userId: bidder.user.id, type: 'OFFER_COUNTERED' } }), 1);
  offer = check(await mutate(bidder.account, `/offers/${offer.id}/counter`, { expectedVersion: offer.version, priceIdr: 220000 }), 201, 'Counter balik');
  check(await mutate(owner.account, `/offers/${offer.id}/reject`, { expectedVersion: offer.version }), 201, 'Tolak');
  assert.equal(await db.inAppNotification.count({ where: { userId: bidder.user.id, type: 'OFFER_REJECTED' } }), 1);
  async function freshOffer(listing = f) { return check(await mutate(bidder.account, `/listings/${listing.id}/offers`, { ...body, expectedListingVersion: listing.version, listingRevisionId: listing.revision.id, clientRequestId: randomUUID(), ...(listing.type === 'DONATE' ? { priceIdr: undefined } : {}) }), 201, 'Penawaran baru'); }
  offer = await freshOffer();
  check(await mutate(bidder.account, `/offers/${offer.id}/withdraw`, { expectedVersion: offer.version }), 201, 'Tarik');
  assert.equal(await db.inAppNotification.count({ where: { userId: owner.user.id, type: 'OFFER_WITHDRAWN' } }), 1);
  offer = await freshOffer();
  await db.offer.update({ where: { id: offer.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const service = new NotificationService(db);
  await service.expire(); await service.expire();
  assert.equal(await db.inAppNotification.count({ where: { type: 'OFFER_EXPIRED', eventKey: { startsWith: `offer:${offer.id}:` } } }), 2);
  check(await bidder.account.request(`/offers/${offer.id}`), 200, 'Detail timeout tidak menduplikasi');
  assert.equal(await db.inAppNotification.count({ where: { type: 'OFFER_EXPIRED', eventKey: { startsWith: `offer:${offer.id}:` } } }), 2);
  offer = await freshOffer();
  check(await mutate(owner.account, `/listings/${f.id}/withdraw`, { expectedVersion: f.version }), 201, 'Tarik listing');
  assert.equal(await db.inAppNotification.count({ where: { type: 'OFFER_EXPIRED', eventKey: { startsWith: `offer:${offer.id}:` }, userId: bidder.user.id } }), 1);
  assert.equal(await db.inAppNotification.count({ where: { type: 'OFFER_EXPIRED', eventKey: { startsWith: `offer:${offer.id}:` }, userId: owner.user.id } }), 0);

  const donation = await listing('DONATE'), donateOffer = await freshOffer(donation);
  let tx = check(await mutate(owner.account, `/offers/${donateOffer.id}/accept`, { expectedVersion: donateOffer.version, offerRevisionId: donateOffer.currentRevision.id, listingRevisionId: donateOffer.listingRevisionId }), 201, 'Kesepakatan');
  const requestBody = { expectedVersion: tx.version, reason: 'Alasan privat pembatalan tidak boleh disalin.' }, key = randomUUID();
  tx = check(await mutate(owner.account, `/transactions/${tx.id}/cancellation-requests`, requestBody, key), 201, 'Minta batal');
  check(await mutate(owner.account, `/transactions/${tx.id}/cancellation-requests`, requestBody, key), 201, 'Retry minta batal');
  assert.equal(await db.inAppNotification.count({ where: { userId: bidder.user.id, type: 'CANCELLATION_REQUESTED' } }), 1);
  tx = check(await mutate(bidder.account, `/transactions/${tx.id}/cancellation-requests/${tx.cancellations[0].id}/respond`, { expectedVersion: tx.version, accept: false }), 201, 'Tolak batal');
  assert.equal(await db.inAppNotification.count({ where: { userId: owner.user.id, type: 'CANCELLATION_REJECTED' } }), 1);

  check(await client().request('/me/notifications'), 401, 'Guest');
  const noCsrf = await fetch(`${base}/api/v1/me/notifications/read-all`, { method: 'POST', headers: { Cookie: owner.account.cookieHeader() } }); assert.equal(noCsrf.status, 403);
  const rows = check(await owner.account.request('/me/notifications'), 200, 'Riwayat');
  assert(rows.length); assert(!JSON.stringify(rows).includes('privat')); assert(!JSON.stringify(rows).includes('eventKey')); assert(!JSON.stringify(rows).includes('userId')); assert(!JSON.stringify(rows).includes('payload'));
  check(await other.account.request(`/me/notifications/${rows[0].id}/read`, { method: 'POST' }), 404, 'Isolasi akun');
  assert.equal(check(await other.account.request('/me/notifications/summary'), 200, 'Belum terverifikasi boleh membaca').unreadCount, 0);
  const read = check(await owner.account.request(`/me/notifications/${rows[0].id}/read`, { method: 'POST' }), 201, 'Baca');
  const repeat = check(await owner.account.request(`/me/notifications/${rows[0].id}/read`, { method: 'POST' }), 201, 'Baca idempoten'); assert.equal(repeat.readAt, read.readAt);
  check(await owner.account.request(`/notifications/${rows[0].id}/read`, { method: 'POST' }), 201, 'Adapter lama');
  assert.equal((await db.inAppNotification.findUniqueOrThrow({ where: { id: rows[0].id } })).readAt.toISOString(), read.readAt);
  for (const query of ['status=no', 'category=no', 'limit=0', 'limit=51', 'cursor=bad']) check(await owner.account.request(`/me/notifications?${query}`), 400, query);
  check(await owner.account.request('/me/notifications/not-a-uuid/read', { method: 'POST' }), 404, 'UUID');
  const page = await owner.account.request('/me/notifications?limit=1&category=offers'); check(page, 200, 'Cursor'); assert(page.payload.meta.nextCursor);
  check(await owner.account.request(`/me/notifications?category=transactions&cursor=${page.payload.meta.nextCursor}`), 400, 'Filter cursor berbeda');
  const boundary = page.payload.data[0]; await db.inAppNotification.delete({ where: { id: boundary.id } });
  const next = check(await owner.account.request(`/me/notifications?limit=1&category=offers&cursor=${page.payload.meta.nextCursor}`), 200, 'Boundary terhapus'); assert(next.length); assert.notEqual(next[0].id, boundary.id);
  const at = new Date('2026-01-01T00:00:00Z');
  await db.inAppNotification.createMany({ data: Array.from({ length: 65 }, (_, i) => ({ userId: other.user.id, eventKey: `notifications-test:${randomUUID()}`, type: 'HANDOVER_REMINDER', payload: { transactionId: tx.id, title: `Fixture ${i}`, day: 7 }, createdAt: at })) });
  const summary = check(await other.account.request('/me/notifications/summary'), 200, 'Count bukan batas halaman'); assert.equal(summary.unreadCount, 65); assert.equal(summary.recent.length, 5);
  const first = await other.account.request('/me/notifications?limit=50'); check(first, 200, 'Timestamp sama');
  const second = check(await other.account.request(`/me/notifications?limit=50&cursor=${first.payload.meta.nextCursor}`), 200, 'Halaman kedua'); assert.equal(second.length, 15); assert.equal(new Set([...first.payload.data, ...second].map(row => row.id)).size, 65);
  const all = check(await other.account.request('/me/notifications/read-all', { method: 'POST' }), 201, 'Baca semua termasuk halaman berikut'); assert.equal(all.count, 65);
  assert.equal(check(await other.account.request('/me/notifications/read-all', { method: 'POST' }), 201, 'Ulang semua').count, 0);
  assert.equal(check(await other.account.request('/me/notifications/summary'), 200, 'Count sesudah baca').unreadCount, 0);
  await db.inAppNotification.create({ data: { userId: other.user.id, type: 'HANDOVER_REMINDER', eventKey: `notification-new:${randomUUID()}`, payload: { transactionId: tx.id, title: 'Kabar baru sesudah baca semua', day: 12 } } });
  assert.equal(check(await other.account.request('/me/notifications/summary'), 200, 'Kabar baru tetap unread').unreadCount, 1);
  assert(check(await owner.account.request('/me/notifications/summary'), 200, 'Tidak memengaruhi akun lain').unreadCount > 0);
  check(await other.account.request('/auth/reauthenticate', { method: 'POST', body: { password: credentials.password } }), 201, 'Reautentikasi');
  check(await other.account.request('/me/close', { method: 'POST', body: { reason: 'Selesai menguji notifikasi.' } }), 201, 'Tutup');
  assert.equal(await db.inAppNotification.count({ where: { userId: other.user.id } }), 0);
  check(await other.account.request('/me/notifications/summary'), 401, 'Sesi dicabut');
  const spec = await (await fetch(base + '/api/docs-json')).json(); assert.equal(spec.info.version, '1.14.0');
  for (const path of ['/me/notifications', '/me/notifications/summary', '/me/notifications/read-all', '/me/notifications/{id}/read']) assert(spec.paths['/api/v1' + path]);
  console.log('Pusat notifikasi smoke lulus: kejadian atomik, rollback, deduplikasi, timeout, privasi, sesi/CSRF, isolasi, cursor/filter, total unread, baca idempoten, adapter, dan penutupan akun.');
} finally {
  if (trigger) await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS notification_failure ON "InAppNotification"');
  await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS notification_test_failure()');
  await db.$disconnect();
}
