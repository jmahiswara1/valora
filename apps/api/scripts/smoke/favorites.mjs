import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../dist/generated/prisma/client.js';
import { base, client, check, login, credentials, createItem, createListing, approve } from '../helpers/fixtures.mjs';

if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Favorit membutuhkan database test.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const seed = await db.user.findUniqueOrThrow({ where: { email: 'owner.demo@valora.local' } });
async function actor(verified = true, role = 'USER') {
  const user = await db.user.create({ data: { email: `favorites-${randomUUID()}@demo.valora.local`, displayName: 'Fixture Favorit', role,
    cityId: seed.cityId, passwordHash: seed.passwordHash, emailVerifiedAt: verified ? new Date() : null } });
  return { user, account: await login(user.email) };
}
const mark = [];
try {
  const owner = await actor(); const viewer = await actor(false); const other = await actor(); const admin = await actor(true, 'ADMIN');
  const published = [];
  for (const type of ['RESELL', 'EXCHANGE', 'DONATE']) {
    const title = `Favorit ${type} ${randomUUID().slice(0, 8)}`;
    const { item, assessment } = await createItem(owner.account, 'electronics', title);
    const draft = await createListing(owner.account, item, assessment, seed.cityId, type, title);
    check(await viewer.account.request(`/me/favorites/${draft.id}`, { method: 'PUT' }), 409, 'Draft tidak dapat disimpan');
    published.push(await approve(admin.account, draft));
  }
  const ids = published.map(row => row.id);
  const status = account => account.request(`/me/favorites/status?listingIds=${ids.join(',')}`);
  check(await client().request('/me/favorites'), 401, 'Guest tidak membaca Favorit');
  const noCsrf = await fetch(`${base}/api/v1/me/favorites/${ids[0]}`, { method: 'PUT', headers: { Cookie: viewer.account.cookieHeader() } });
  assert.equal(noCsrf.status, 403);
  for (const id of ids) check(await viewer.account.request(`/me/favorites/${id}`, { method: 'PUT' }), 200, 'Akun belum terverifikasi boleh menyimpan');
  const before = await db.favorite.findUniqueOrThrow({ where: { userId_listingId: { userId: viewer.user.id, listingId: ids[0] } } });
  await Promise.all(Array.from({ length: 3 }, () => viewer.account.request(`/me/favorites/${ids[0]}`, { method: 'PUT' }).then(r => check(r, 200, 'Simpan serentak'))));
  const after = await db.favorite.findUniqueOrThrow({ where: { userId_listingId: { userId: viewer.user.id, listingId: ids[0] } } });
  assert.equal(before.createdAt.toISOString(), after.createdAt.toISOString());
  assert.equal(await db.favorite.count({ where: { userId: viewer.user.id } }), 3);
  assert(check(await status(viewer.account), 200, 'Status batch').every(row => row.isFavorite));
  assert(check(await status(other.account), 200, 'Status akun lain').every(row => !row.isFavorite));
  check(await other.account.request(`/me/favorites/${ids[0]}`, { method: 'DELETE' }), 200, 'Hapus akun lain tidak mengubah Favorit viewer');
  assert.equal((await db.favorite.count({ where: { userId: viewer.user.id } })), 3);
  assert.equal(check(await other.account.request(`/me/favorites?userId=${viewer.user.id}`), 200, 'Tidak menerima identitas dari query').length, 0);
  for (const query of ['listingIds=bad', `listingIds=${ids[0]},${ids[0]}`, 'listingIds=', `listingIds=${Array.from({ length: 101 }, () => randomUUID()).join(',')}`]) {
    check(await viewer.account.request('/me/favorites/status?' + query), 400, 'Validasi batch');
  }
  check(await viewer.account.request('/me/favorites/bad', { method: 'PUT' }), 404, 'UUID route');
  check(await viewer.account.request(`/me/favorites/${randomUUID()}`, { method: 'PUT' }), 404, 'Listing tidak ada');
  for (const query of ['limit=0', 'limit=51', 'cursor=bad', 'cursor=']) check(await viewer.account.request('/me/favorites?' + query), 400, 'Validasi pagination');
  mark.push('auth, CSRF, unverified account, isolation, batch validation, concurrent idempotency');

  // Equal timestamps exercise the stable UUID tie breaker and deleted-cursor boundary.
  await db.favorite.updateMany({ where: { userId: viewer.user.id }, data: { createdAt: new Date('2026-10-04T00:00:00Z') } });
  const first = await viewer.account.request('/me/favorites?limit=1'); check(first, 200, 'Halaman pertama');
  const cursor = first.payload.meta.nextCursor; assert(cursor);
  const deletedId = first.payload.data[0].listingId;
  check(await viewer.account.request(`/me/favorites/${deletedId}`, { method: 'DELETE' }), 200, 'Hapus boundary');
  const next = await viewer.account.request('/me/favorites?limit=2&cursor=' + cursor); check(next, 200, 'Boundary yang dihapus tetap berfungsi');
  assert.equal(next.payload.data.length, 2); assert.equal(next.payload.meta.nextCursor, null);
  assert(!next.payload.data.some(row => row.listingId === deletedId));
  check(await viewer.account.request(`/me/favorites/${deletedId}`, { method: 'PUT' }), 200, 'Simpan ulang');
  mark.push('stable pagination and removal boundary');

  await db.listingRevision.update({ where: { id: published[0].revision.id }, data: { title: 'Judul publik terkini untuk Favorit' } });
  let rows = check(await viewer.account.request('/me/favorites'), 200, 'Revisi terkini');
  assert.equal(rows.find(row => row.listingId === ids[0]).listing.revision.title, 'Judul publik terkini untuk Favorit');
  assert.equal(rows.find(row => row.listingId === ids[0]).savedTitle, published[0].revision.title);
  for (const listingStatus of ['RESERVED', 'CLOSED', 'WITHDRAWN', 'SUSPENDED', 'PAUSED']) {
    await db.listing.update({ where: { id: ids[0] }, data: { status: listingStatus } });
    await db.listingRevision.update({ where: { id: published[0].revision.id }, data: { description: 'PRIVATE_AFTER_WITHDRAWAL', title: 'PRIVATE_CURRENT_TITLE' } });
    rows = check(await viewer.account.request('/me/favorites'), 200, 'Favorit tidak tersedia');
    const row = rows.find(row => row.listingId === ids[0]); assert(row);
    assert.equal(row.availability, listingStatus === 'RESERVED' ? 'RESERVED' : 'UNAVAILABLE');
    assert.equal(row.listing, null); assert.equal(row.savedTitle, published[0].revision.title);
    assert(!JSON.stringify(row).includes('PRIVATE_')); assert(!JSON.stringify(row).includes('/media/'));
    check(await viewer.account.request(`/me/favorites/${ids[0]}`, { method: 'PUT' }), 200, 'Retry existing Favorit tetap berhasil');
    check(await other.account.request(`/me/favorites/${ids[0]}`, { method: 'PUT' }), 409, 'Favorit baru tidak boleh menyalin listing privat');
    const media = await fetch(`${base}/api/v1/market/${ids[0]}/media/${published[0].revision.media[0].id}`); assert.equal(media.status, 404);
  }
  for (let i = 0; i < 2; i++) check(await viewer.account.request(`/me/favorites/${ids[0]}`, { method: 'DELETE' }), 200, 'Hapus idempoten barang berakhir');
  mark.push('current revision, reserved/closed/withdrawn/suspended privacy and repeated removal');

  await db.session.updateMany({ where: { userId: other.user.id }, data: { revokedAt: new Date() } });
  check(await other.account.request('/me/favorites'), 401, 'Sesi dicabut');
  check(await viewer.account.request('/auth/reauthenticate', { method: 'POST', body: { password: credentials.password } }), 201, 'Reautentikasi');
  check(await viewer.account.request('/me/close', { method: 'POST', body: { reason: 'Fixture Favorit selesai.' } }), 201, 'Tutup akun');
  assert.equal(await db.favorite.count({ where: { userId: viewer.user.id } }), 0);
  check(await viewer.account.request('/me/favorites'), 401, 'Akun ditutup kehilangan akses');
  mark.push('revocation and account closure cleanup');
  const doc = await (await fetch(base + '/api/docs-json')).json();
  assert.equal(doc.info.version, '1.11.0');
  for (const path of ['/api/v1/me/favorites', '/api/v1/me/favorites/status', '/api/v1/me/favorites/{listingId}']) assert(doc.paths[path]);
  mark.push('OpenAPI 1.11.0');
  console.log(JSON.stringify({ suite: 'favorites', passed: mark }));
} finally { await db.$disconnect(); }
