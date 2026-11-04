import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../dist/generated/prisma/client.js';
import { PassportImpactService } from '../../dist/modules/history/projection.service.js';
import { PublicProfilesService } from '../../dist/modules/profile/public.service.js';
import { StorageService } from '../../dist/infrastructure/storage.service.js';
import { publicRead } from '../../dist/shared/public-read.js';
import { client, check, login, createItem, createListing, approve, photo } from '../helpers/fixtures.mjs';

if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Hardening smoke requires a test database');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const lock = new pg.Client({ connectionString: process.env.DATABASE_URL });
const label = 'Hardening ' + randomUUID().slice(0, 8);
const seed = await db.user.findUniqueOrThrow({ where: { email: 'owner.demo@valora.local' } });
const guest = client();
const post = (account, path, body) => account.request(path, { method: 'POST', body });
async function actor(role = 'USER') {
  const row = await db.user.create({ data: { email: `hardening-${randomUUID()}@demo.valora.local`, passwordHash: seed.passwordHash, displayName: label, cityId: seed.cityId, emailVerifiedAt: new Date(), role } });
  return { ...row, account: await login(row.email) };
}
async function deadline(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Public read waited for the mutation gate')), 5000); })]); }
  finally { clearTimeout(timer); }
}
try {
  const [seller, buyer, admin] = await Promise.all([actor(), actor(), actor('ADMIN')]);
  async function publish(owner, suffix) {
    const fixture = await createItem(owner.account, 'electronics', `${label} ${suffix}`);
    const listing = await createListing(owner.account, fixture.item, fixture.assessment, seed.cityId, 'RESELL', `${label} ${suffix}`);
    const published = await approve(admin.account, listing);
    return { ...fixture, listing: { ...listing, version: published.version }, published };
  }
  const sale = await publish(seller, 'closing'), other = await publish(buyer, 'remaining');
  const offer = async (bidder, listing) => check(await post(bidder.account, `/listings/${listing.id}/offers`, {
    clientRequestId: randomUUID(), expectedListingVersion: listing.version, listingRevisionId: listing.currentRevision.id, priceIdr: 300000,
  }), 201, 'Offer');
  const incoming = await offer(buyer, sale.listing), outgoing = await offer(seller, other.listing);
  check(await buyer.account.request(`/me/favorites/${sale.listing.id}`, { method: 'PUT' }), 200, 'Save closing listing');
  check(await post(seller.account, '/me/close', { reason: 'Hardening closure regression' }), 201, 'Close account');
  assert.equal((await db.listing.findUniqueOrThrow({ where: { id: sale.listing.id } })).status, 'WITHDRAWN');
  for (const id of [incoming.id, outgoing.id]) assert.equal((await db.offer.findUniqueOrThrow({ where: { id } })).endReason, 'ACCOUNT_CLOSED');
  assert.equal((await guest.request(`/market/${sale.listing.id}`)).status, 404);
  assert.equal((await guest.request(`/profiles/${seller.id}`)).status, 404);
  // Also hide legacy ACTIVE records whose owner was already closed before this fix.
  await db.listing.update({ where: { id: sale.listing.id }, data: { status: 'ACTIVE' } });
  try {
    assert.equal((await guest.request(`/market/${sale.listing.id}`)).status, 404);
    assert.equal((await guest.request(`/market/${sale.listing.id}/media/${sale.item.media[0].id}`)).status, 404);
    const market = check(await guest.request(`/market?q=${encodeURIComponent(label)}`), 200, 'Public market');
    assert(!market.some(row => row.id === sale.listing.id));
    const favorites = check(await buyer.account.request('/me/favorites'), 200, 'Favorites');
    assert.equal(favorites.find(row => row.listingId === sale.listing.id).availability, 'UNAVAILABLE');
  } finally { await db.listing.update({ where: { id: sale.listing.id }, data: { status: 'WITHDRAWN' } }); }

  const storage = new StorageService(), passport = new PassportImpactService(db, storage), profiles = new PublicProfilesService(db);
  await lock.connect(); await lock.query('BEGIN'); await lock.query('SELECT pg_advisory_xact_lock(610006)');
  try {
    const [item, profile, impact] = await deadline(Promise.all([passport.passport(other.item.id), profiles.get(buyer.id), passport.impact()]));
    assert.equal(item.projection, 'PUBLIC'); assert.equal(profile.id, buyer.id); assert(Array.isArray(impact.metrics));
  } finally { await lock.query('ROLLBACK'); }

  await publicRead(db, async tx => {
    const first = await tx.item.findUniqueOrThrow({ where: { id: other.item.id } });
    await db.item.update({ where: { id: other.item.id }, data: { passportVisibility: 'HIDDEN' } });
    const second = await tx.item.findUniqueOrThrow({ where: { id: other.item.id } });
    assert.equal(second.passportVisibility, first.passportVisibility, 'Projection uses a consistent snapshot');
  });
  assert.equal((await guest.request(`/passport/${other.item.id}`)).status, 404, 'Fresh projection observes hidden visibility');
  await db.item.update({ where: { id: other.item.id }, data: { passportVisibility: 'PUBLIC' } });
  await assert.rejects(publicRead(db, tx => tx.user.update({ where: { id: buyer.id }, data: { displayName: 'Unexpected write' } })));
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: buyer.id } })).displayName, label);

  const extra = await createItem(buyer.account, 'electronics', `${label} media`);
  const ticket = check(await post(buyer.account, `/items/${extra.item.id}/media/tickets`, { fileName: 'photo.webp', mime: 'image/webp', bytes: photo.length }), 201, 'Upload ticket');
  const firstUpload = check(await buyer.account.request(ticket.uploadUrl.replace('/api/v1', ''), { method: 'PUT', type: 'image/webp', body: photo }), 200, 'Upload');
  const replay = check(await buyer.account.request(ticket.uploadUrl.replace('/api/v1', ''), { method: 'PUT', type: 'image/webp', body: photo }), 200, 'Upload replay');
  assert.deepEqual(replay, firstUpload);
  const withPhotos = check(await post(buyer.account, `/items/${extra.item.id}/media/finalize`, { ticketId: ticket.ticketId }), 201, 'Finalize');
  const added = withPhotos.media.find(media => !extra.item.media.some(old => old.id === media.id));
  const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: added.id } });
  check(await buyer.account.request(`/items/${extra.item.id}/media/${added.id}`, { method: 'DELETE' }), 200, 'Delete photo');
  assert((await db.mediaAsset.findUniqueOrThrow({ where: { id: added.id } })).deletedAt);
  assert(await db.storageDeletion.findUnique({ where: { storageKey: asset.storageKey } }), 'Physical deletion is durably queued');
  console.log('Hardening smoke passed: account closure/listings/offers/photos/favorites, upload replay, durable deletion, public reads outside mutation gate, read-only consistent snapshots and fresh visibility.');
} finally { await lock.end(); await db.$disconnect(); }
