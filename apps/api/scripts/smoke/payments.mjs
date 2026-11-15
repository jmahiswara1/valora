import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../dist/generated/prisma/client.js';
import { exchangeHash } from '../../dist/shared/exchange.js';
import { check, client, createItem, createListing, approve } from '../helpers/fixtures.mjs';
import { handoverActors, handoverTransaction, mutate } from '../helpers/handover.mjs';
if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw Error('Test database required');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const actors = await handoverActors(db), { owner, buyer, outsider, admin, seed } = actors;
  const transaction = await handoverTransaction(db, actors), path = '/transactions/' + transaction.id + '/demo-payment';
  const input = { expectedVersion: transaction.version, demoOnly: true }, key = randomUUID();
  check(await client().request(path), 401, 'Login required');
  check(await outsider.account.request(path), 404, 'Participant-only payment');
  check(await admin.account.request(path), 404, 'No unrestricted admin payment access');
  const initial = check(await buyer.account.request(path), 200, 'Initial payment');
  assert.equal(initial.mode, 'DEMO'); assert.equal(initial.method, 'QRIS'); assert.equal(initial.amountIdr, transaction.finalPriceIdr); assert(initial.canSimulate);
  check(await mutate(owner.account, path + '/confirm', input), 403, 'Only payer may simulate');
  check(await mutate(buyer.account, path + '/confirm', { ...input, demoOnly: false }), 400, 'Demo consent required');
  check(await mutate(buyer.account, path + '/confirm', { ...input, amountIdr: 1, method: 'BANK_TRANSFER' }), 400, 'Amount and method cannot be supplied');
  check(await mutate(buyer.account, path + '/confirm', { ...input, expectedVersion: transaction.version + 1 }), 409, 'Stale version');
  const outcomes = await Promise.all([mutate(buyer.account, path + '/confirm', input, key), mutate(buyer.account, path + '/confirm', input, key)]);
  const paid = check(outcomes[0], 201, 'QRIS simulation'); assert.equal(check(outcomes[1], 201, 'Replay').reference, paid.reference);
  assert.equal(paid.status, 'PAID'); assert.equal(paid.amountIdr, transaction.finalPriceIdr); assert.equal(paid.canSimulate, false);
  assert.equal(await db.demoPayment.count({ where: { transactionId: transaction.id } }), 1);
  assert.equal(check(await mutate(buyer.account, path + '/confirm', input), 201, 'Repeat with new key').reference, paid.reference);
  const after = check(await buyer.account.request('/transactions/' + transaction.id), 200, 'After demo');
  assert.equal(after.status, transaction.status); assert.equal(after.confirmations.length, 0); assert.equal(after.cashConfirmations.length, 0); assert.equal(after.version, transaction.version + 1);
  assert.equal(check(await owner.account.request(path), 200, 'Seller sees demo').reference, paid.reference);
  assert.equal(check(await mutate(buyer.account, '/me/actions/status', { operation: 'demo-pay:' + transaction.id, key }), 201, 'Payment recovery').status, 'COMMITTED');

  const donation = await handoverTransaction(db, actors, 'DONATE');
  assert.equal(check(await buyer.account.request('/transactions/' + donation.id + '/demo-payment'), 200, 'Free donation').status, 'NOT_REQUIRED');
  check(await mutate(buyer.account, '/transactions/' + donation.id + '/demo-payment/confirm', { expectedVersion: donation.version, demoOnly: true }), 422, 'No charge for donation');
  const held = await handoverTransaction(db, actors);
  const cancel = check(await mutate(owner.account, '/transactions/' + held.id + '/cancellation-requests', { expectedVersion: held.version, reason: 'Meninjau jadwal sebelum melanjutkan.' }), 201, 'Pending cancellation');
  const heldState = check(await buyer.account.request('/transactions/' + held.id + '/demo-payment'), 200, 'Held demo'); assert(!heldState.canSimulate);
  check(await mutate(buyer.account, '/transactions/' + held.id + '/demo-payment/confirm', { expectedVersion: heldState.version, demoOnly: true }), 409, 'Cancellation blocks simulation');
  const pendingCancel = cancel.cancellations.find(row => row.status === 'PENDING');
  check(await mutate(buyer.account, '/transactions/' + held.id + '/cancellation-requests/' + pendingCancel.id + '/respond', { expectedVersion: cancel.version, accept: true }), 201, 'Cancel agreement');
  const closed = check(await buyer.account.request('/transactions/' + held.id + '/demo-payment'), 200, 'Closed payment');
  check(await mutate(buyer.account, '/transactions/' + held.id + '/demo-payment/confirm', { expectedVersion: closed.version, demoOnly: true }), 409, 'Closed agreement cannot pay');

  for (const payer of ['OWNER', 'BIDDER']) {
    const fixture = await createItem(owner.account, 'electronics', 'Tukar QRIS ' + payer + randomUUID().slice(0, 6));
    const listing = await approve(admin.account, await createListing(owner.account, fixture.item, fixture.assessment, seed.cityId, 'EXCHANGE', fixture.item.title));
    const other = await createItem(buyer.account, 'electronics', 'Barang penukar QRIS ' + randomUUID().slice(0, 6));
    const offer = check(await mutate(buyer.account, '/listings/' + listing.id + '/offers', { clientRequestId: randomUUID(), expectedListingVersion: listing.version, listingRevisionId: listing.revision.id, exchangeItemIds: [other.item.id], cashAdjustment: { payer, amountIdr: 50000 } }), 201, 'Exchange cash offer');
    let current = check(await mutate(owner.account, '/offers/' + offer.id + '/accept', { expectedVersion: offer.version, offerRevisionId: offer.currentRevision.id, listingRevisionId: offer.listingRevisionId, exchangeTermsHash: exchangeHash(offer.currentRevision.exchangeTerms) }), 201, 'Accept exchange');
    for (const expected of current.requiredConfirmations) current = check(await mutate((expected.actorId === owner.user.id ? owner : buyer).account, '/transactions/' + current.id + '/confirmations', { expectedVersion: current.version, itemId: expected.itemId, kind: expected.kind }), 201, 'Goods confirmation');
    assert.equal(current.status, 'ONE_SIDE_CONFIRMED');
    const actor = payer === 'OWNER' ? owner : buyer, recipient = payer === 'OWNER' ? buyer : owner;
    const detail = check(await actor.account.request('/transactions/' + current.id + '/demo-payment'), 200, 'Exchange payment terms');
    assert.equal(detail.payerId, actor.user.id); assert.equal(detail.receiverId, recipient.user.id); assert.equal(detail.amountIdr, 50000);
    check(await mutate(recipient.account, '/transactions/' + current.id + '/demo-payment/confirm', { expectedVersion: current.version, demoOnly: true }), 403, 'Receiver cannot simulate payment');
    check(await mutate(actor.account, '/transactions/' + current.id + '/demo-payment/confirm', { expectedVersion: current.version, demoOnly: true }), 201, 'Simulate top-up');
    const completed = check(await actor.account.request('/transactions/' + current.id), 200, 'Exchange completes after demo and goods');
    assert.equal(completed.status, 'COMPLETED'); assert.equal(completed.cashConfirmations.length, 0, 'Demo never invents real cash confirmations');
  }
  console.log('QRIS demo passed: participant/payer access, canonical amount, no real cash reports, replay/recovery, cancellation, donation and exchange settlement.');
} finally { await db.$disconnect(); }
