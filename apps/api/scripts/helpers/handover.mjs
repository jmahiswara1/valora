import { randomUUID } from 'node:crypto';
import { login, createItem, createListing, approve, check } from './fixtures.mjs';
export const mutate = (account, path, body, key = randomUUID()) => account.request(path, { method: 'POST', body, extraHeaders: { 'Idempotency-Key': key } });
export async function handoverActors(db) {
  const seed = await db.user.findUniqueOrThrow({ where: { email: 'owner.demo@valora.local' } });
  async function actor(role = 'USER') { const user = await db.user.create({ data: { email: `handover-${randomUUID()}@demo.valora.local`, displayName: role === 'ADMIN' ? 'Admin Koordinasi' : 'Peserta Koordinasi', cityId: seed.cityId, passwordHash: seed.passwordHash, emailVerifiedAt: new Date(), role } }); return { user, account: await login(user.email) }; }
  return { seed, owner: await actor(), buyer: await actor(), outsider: await actor(), admin: await actor('ADMIN') };
}
export async function handoverTransaction(db, actors, type = 'RESELL', methods = ['MEETUP', 'DELIVERY']) {
  const { owner, buyer, admin, seed } = actors;
  const fixture = await createItem(owner.account, 'electronics', 'Perangkat koordinasi ' + type);
  const submitted = await createListing(owner.account, fixture.item, fixture.assessment, seed.cityId, type, fixture.item.title);
  // Fixture method variation; moderation, offers and acceptance use the real API.
  await db.listingRevision.updateMany({ where: { listingId: submitted.id }, data: { handoverMethods: methods } });
  const listing = await approve(admin.account, submitted);
  const exchange = type === 'EXCHANGE' ? await createItem(buyer.account, 'electronics', 'Barang tukar koordinasi') : null;
  const offer = check(await buyer.account.request(`/listings/${listing.id}/offers`, { method: 'POST', body: { expectedListingVersion: listing.version, listingRevisionId: listing.revision.id, clientRequestId: randomUUID(), ...(type === 'RESELL' ? { priceIdr: 300000 } : exchange ? { exchangeItemId: exchange.item.id } : {}) } }), 201, 'Offer coordination');
  return check(await mutate(owner.account, `/offers/${offer.id}/accept`, { expectedVersion: offer.version, offerRevisionId: offer.currentRevision.id, listingRevisionId: offer.listingRevisionId }), 201, 'Accept coordination');
}
export const destination = { recipientName: 'Penerima Fixture', phone: '081234567890', address: 'Jalan Fixture Privat nomor 12, Kediri' };
