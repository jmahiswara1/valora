import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../dist/generated/prisma/client.js';
import { SearchesService } from '../../dist/modules/searches/service.js';
import { SearchJobs } from '../../dist/infrastructure/jobs/searches.service.js';
import { base, client, check, credentials, login, createItem, createListing, approve } from '../helpers/fixtures.mjs';

if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Pencarian membutuhkan database test.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const jobLock = new pg.Client({ connectionString: process.env.DATABASE_URL });
await jobLock.connect(); await jobLock.query("SELECT pg_advisory_lock(hashtextextended('valora-job:saved-search-alerts',0))");
const seed = await db.user.findUniqueOrThrow({ where: { email: 'owner.demo@valora.local' } });
const service = new SearchesService(db);
async function drain() { for (let i = 0; i < 200; i++) if (!await service.processBatch()) return; throw new Error('Antrean tidak selesai.'); }
async function actor(verified = false, role = 'USER') {
  const user = await db.user.create({ data: { email: `search-${randomUUID()}@demo.valora.local`, displayName: 'Fixture Pencarian', cityId: seed.cityId, passwordHash: seed.passwordHash, emailVerifiedAt: verified ? new Date() : null, role } });
  return { user, account: await login(user.email) };
}
const post = (actor, filters, extra = {}) => actor.account.request('/me/saved-searches', { method: 'POST', body: { name: 'Pencarian pengujian', filters, ...extra } });
let trigger = '';
try {
  await drain();
  const owner = await actor(true), reader = await actor(), other = await actor(), admin = await actor(true, 'ADMIN');
  check(await client().request('/me/saved-searches'), 401, 'Guest');
  const noCsrf = await fetch(base + '/api/v1/me/saved-searches', { method: 'POST', headers: { Cookie: reader.account.cookieHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Tanpa CSRF', filters: { q: 'meja' } }) }); assert.equal(noCsrf.status, 403);
  for (const filters of [{}, { q: ' ' }, { q: 'x'.repeat(101) }, { cityId: 'bad' }, { type: 'NO' }, { condition: 'NO' }, { minPriceIdr: -1 }, { minPriceIdr: 3, maxPriceIdr: 2 }, { minPriceIdr: true }, { type: 'DONATE', maxPriceIdr: 1 }, { category: 'unknown' }]) check(await post(reader, filters), 400, 'Kriteria tidak valid');
  check(await post(reader, { q: 'valid' }, { sort: 'price_asc' }), 400, 'Urutan harga memerlukan RESELL');
  check(await post(reader, { q: 'valid' }, { name: '' }), 400, 'Nama kosong');
  const label = `Pencarian ${randomUUID().slice(0, 8)}`;
  const { item, assessment } = await createItem(owner.account, 'electronics', label);
  const draft = await createListing(owner.account, item, assessment, seed.cityId, 'RESELL', label);
  const condition = draft.currentRevision.condition >= 75 ? 'EXCELLENT' : draft.currentRevision.condition >= 50 ? 'GOOD' : 'NEEDS_ATTENTION';
  const criteria = { q: label, category: 'electronics', type: 'RESELL', cityId: seed.cityId, condition, minPriceIdr: 350000, maxPriceIdr: 350000 };
  let saved = check(await post(reader, criteria, { sort: 'price_asc' }), 201, 'Kriteria lengkap, akun belum terverifikasi');
  const duplicate = check(await post(reader, { ...criteria, q: ` ${label.toUpperCase()} ` }, { name: 'Jangan menimpa', sort: 'price_desc', alertsEnabled: false }), 201, 'Normalisasi duplikasi');
  assert.equal(duplicate.id, saved.id); assert.equal(duplicate.name, saved.name); assert.equal(duplicate.alertsEnabled, true); assert.equal(duplicate.sort, 'price_asc');
  const overlap = check(await post(reader, { q: label }), 201, 'Kriteria tumpang tindih');
  check(await post(owner, { q: label }), 201, 'Listing sendiri');
  check(await post(other, { q: label, maxPriceIdr: 349999 }), 201, 'Tidak cocok harga');
  const listing = await approve(admin.account, draft);
  assert.equal(await db.searchPublication.count({ where: { listingId: listing.id } }), 1);
  assert((await db.listing.findUniqueOrThrow({ where: { id: listing.id } })).firstPublishedAt);
  let late = check(await post(other, { q: label }), 201, 'Simpan setelah terbit');
  // Inject notification failure: neither notification nor checkpoint may commit.
  await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION search_notification_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.payload->>'listingId' = TG_ARGV[0] THEN RAISE EXCEPTION 'search notification rollback'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER search_notification_failure BEFORE INSERT ON "InAppNotification" FOR EACH ROW EXECUTE FUNCTION search_notification_failure('${listing.id}')`); trigger = 'notification';
  await assert.rejects(service.processBatch());
  const pending = await db.searchPublication.findUniqueOrThrow({ where: { listingId: listing.id } }); assert.equal(pending.afterSearchId, null); assert.equal(pending.processedAt, null);
  assert.equal(await db.inAppNotification.count({ where: { type: 'SAVED_SEARCH_MATCH', userId: reader.user.id } }), 0);
  await db.$executeRawUnsafe('DROP TRIGGER search_notification_failure ON "InAppNotification"'); trigger = '';
  await new SearchJobs(service).run(); assert.equal((await db.searchPublication.findUniqueOrThrow({ where: { listingId: listing.id } })).processedAt, null, 'Dedicated job lock prevents a second worker');
  await drain(); await drain();
  const rows = check(await reader.account.request('/me/notifications?category=market'), 200, 'Kategori Market'); assert.equal(rows.length, 1); assert.equal(rows[0].target.kind, 'LISTING'); assert.equal(rows[0].target.id, listing.id);
  assert.equal(check(await reader.account.request('/me/notifications?category=transactions'), 200, 'Kategori transaksi terpisah').length, 0);
  assert.equal(check(await reader.account.request('/me/notifications/summary'), 200, 'Badge').unreadCount, 1);
  assert.equal(await db.inAppNotification.count({ where: { type: 'SAVED_SEARCH_MATCH', userId: { in: [owner.user.id, other.user.id] } } }), 0);
  const read = check(await reader.account.request(`/me/notifications/${rows[0].id}/read`, { method: 'POST' }), 201, 'Baca notifikasi');
  await drain(); assert.equal((await db.inAppNotification.findUniqueOrThrow({ where: { id: rows[0].id } })).readAt.toISOString(), read.readAt);
  // Reapproval is not a first publication.
  const again = await db.listing.update({ where: { id: listing.id }, data: { status: 'PENDING_REVIEW', publishedAt: null, version: { increment: 1 } } });
  await approve(admin.account, { ...draft, version: again.version }); await drain(); assert.equal(await db.searchPublication.count({ where: { listingId: listing.id } }), 1);
  check(await other.account.request(`/me/saved-searches/${saved.id}`, { method: 'PATCH', body: { expectedVersion: saved.version, name: 'Asing' } }), 404, 'Isolasi ubah');
  check(await other.account.request(`/me/saved-searches/${saved.id}`, { method: 'DELETE' }), 200, 'Hapus asing tidak menghapus milik orang');
  assert(await db.savedSearch.findUnique({ where: { id: saved.id } }));
  saved = check(await reader.account.request(`/me/saved-searches/${saved.id}`, { method: 'PATCH', body: { expectedVersion: saved.version, name: 'Nama diperbarui' } }), 200, 'Ubah nama');
  check(await reader.account.request(`/me/saved-searches/${saved.id}`, { method: 'PATCH', body: { expectedVersion: saved.version - 1, name: 'Usang' } }), 409, 'Versi usang');
  for (let i = 0; i < 8; i++) check(await post(reader, { q: `quota-${randomUUID()}` }), 201, 'Slot pencarian');
  check(await post(reader, { q: 'melewati batas' }), 409, 'Batas 10'); check(await post(reader, criteria), 201, 'Duplikasi masih boleh saat penuh');
  check(await reader.account.request(`/me/saved-searches/${overlap.id}`, { method: 'DELETE' }), 200, 'Hapus'); check(await reader.account.request(`/me/saved-searches/${overlap.id}`, { method: 'DELETE' }), 200, 'Hapus ulang');
  const concurrent = await Promise.all([post(reader, { q: 'konkuren' }), post(reader, { q: 'konkuren' })]); assert.equal(check(concurrent[0], 201, 'Konkuren 1').id, check(concurrent[1], 201, 'Konkuren 2').id);
  // Reactivation skips already queued publications, even before the worker runs.
  late = check(await other.account.request(`/me/saved-searches/${late.id}`, { method: 'PATCH', body: { expectedVersion: late.version, alertsEnabled: false } }), 200, 'Nonaktif');
  const nextItem = await createItem(owner.account, 'electronics', label + ' berikutnya');
  const next = await approve(admin.account, await createListing(owner.account, nextItem.item, nextItem.assessment, seed.cityId, 'RESELL', nextItem.item.title));
  late = check(await other.account.request(`/me/saved-searches/${late.id}`, { method: 'PATCH', body: { expectedVersion: late.version, alertsEnabled: true } }), 200, 'Aktif kembali');
  await drain(); assert.equal(await db.inAppNotification.count({ where: { userId: other.user.id, type: 'SAVED_SEARCH_MATCH' } }), 0);
  // A queue insert failure rolls back moderation, review and first-publication marker.
  const failureItem = await createItem(owner.account, 'electronics', 'Rollback ' + randomUUID().slice(0, 8));
  const failureDraft = await createListing(owner.account, failureItem.item, failureItem.assessment, seed.cityId, 'RESELL', failureItem.item.title);
  await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION search_publication_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."listingId"::text = TG_ARGV[0] THEN RAISE EXCEPTION 'publication rollback'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER search_publication_failure BEFORE INSERT ON "SearchPublication" FOR EACH ROW EXECUTE FUNCTION search_publication_failure('${failureDraft.id}')`); trigger = 'publication';
  check(await admin.account.request(`/admin/listing-reviews/${failureDraft.currentRevision.id}/decide`, { method: 'POST', extraHeaders: { 'Idempotency-Key': randomUUID() }, body: { expectedVersion: failureDraft.version, decision: 'APPROVE', reasonCode: 'REVIEW_PASSED', reasonText: 'Mengukur rollback antrean publikasi.' } }), 500, 'Rollback publikasi');
  const failed = await db.listing.findUniqueOrThrow({ where: { id: failureDraft.id } }); assert.equal(failed.status, 'PENDING_REVIEW'); assert.equal(failed.firstPublishedAt, null);
  await db.$executeRawUnsafe('DROP TRIGGER search_publication_failure ON "SearchPublication"'); trigger = '';
  const failureListing = await approve(admin.account, failureDraft);
  await db.listing.update({ where: { id: failureListing.id }, data: { status: 'WITHDRAWN', publishedAt: null } }); await drain(); assert((await db.searchPublication.findUniqueOrThrow({ where: { listingId: failureListing.id } })).processedAt);
  // More than one batch, resumed through a fresh service instance.
  await db.savedSearch.updateMany({ data: { alertsEnabled: false } });
  const ids = Array.from({ length: 101 }, () => randomUUID()), batchQ = 'Batch ' + randomUUID().slice(0, 8);
  await db.user.createMany({ data: ids.map(id => ({ id, email: `batch-${id}@demo.valora.local`, displayName: 'Fixture batch', cityId: seed.cityId, passwordHash: seed.passwordHash })) });
  await db.savedSearch.createMany({ data: ids.map(userId => ({ userId, name: 'Batch', filters: { q: batchQ }, fingerprint: 'a'.repeat(64) })) });
  const batchItem = await createItem(owner.account, 'electronics', batchQ);
  const batchListing = await approve(admin.account, await createListing(owner.account, batchItem.item, batchItem.assessment, seed.cityId, 'RESELL', batchQ));
  await service.processBatch(); const halfway = await db.searchPublication.findUniqueOrThrow({ where: { listingId: batchListing.id } }); assert(halfway.afterSearchId); assert.equal(halfway.processedAt, null);
  assert.equal(await db.inAppNotification.count({ where: { type: 'SAVED_SEARCH_MATCH', userId: { in: ids } } }), 100);
  await new SearchesService(db).processBatch(); await drain(); assert.equal(await db.inAppNotification.count({ where: { type: 'SAVED_SEARCH_MATCH', userId: { in: ids } } }), 101);
  check(await other.account.request('/auth/reauthenticate', { method: 'POST', body: { password: credentials.password } }), 201, 'Reautentikasi');
  check(await other.account.request('/me/close', { method: 'POST', body: {} }), 201, 'Tutup akun'); assert.equal(await db.savedSearch.count({ where: { userId: other.user.id } }), 0);
  const spec = await (await fetch(base + '/api/docs-json')).json(); assert.equal(spec.info.version, '1.12.0');
  for (const path of ['/me/saved-searches', '/me/saved-searches/{id}']) assert(spec.paths['/api/v1' + path]);
  console.log('Pencarian tersimpan smoke lulus: validasi, batas, CSRF/sesi, duplikasi, versi, pencocokan, notifikasi privat, publikasi pertama, watermark aktivasi, rollback, worker lock/checkpoint/restart, dan penutupan akun.');
} finally {
  if (trigger === 'notification') await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS search_notification_failure ON "InAppNotification"');
  if (trigger === 'publication') await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS search_publication_failure ON "SearchPublication"');
  await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS search_notification_failure()'); await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS search_publication_failure()');
  await jobLock.end(); await db.$disconnect();
}
