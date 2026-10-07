import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from "../../dist/generated/prisma/client.js";
import { base, client, check, credentials, photo, login, createItem, createListing, approve } from "../helpers/fixtures.mjs";

if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Stage 4 smoke hanya boleh memakai database test.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const owner = await login('owner.demo@valora.local'); const bidder = await login('member.demo@valora.local'); const admin = await login('admin.demo@valora.local'); const guest = client();
const ownerProfile = check(await owner.request('/me'), 200, 'Profil owner'); const bidderProfile = check(await bidder.request('/me'), 200, 'Profil penawar');
const adminProfile = check(await admin.request('/me'), 200, 'Profil admin');
async function extraUser(role = 'USER') {
  const email = `stage4-${randomUUID()}@demo.valora.local`; const c = client();
  check(await c.request('/auth/csrf'), 200, 'CSRF akun fixture');
  const user = check(await c.request('/auth/register', { method: 'POST', body: { email, password: credentials.password, displayName: 'Pengguna uji tahap empat', cityId: ownerProfile.city.id } }), 201, 'Daftar akun fixture');
  await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date(), role } });
  return { account: await login(email), id: user.id };
}
const third = await extraUser(); const secondAdmin = await extraUser('ADMIN');
const mutate = (account, path, body, key = randomUUID()) => account.request(path, { method: 'POST', body, extraHeaders: { 'Idempotency-Key': key } });
async function listing(type = 'RESELL', account = owner, partial = false) {
  const fixture = await createItem(account, 'electronics', `Demo tahap 4 ${type} ${randomUUID().slice(0, 6)}`);
  if (partial) {
    fixture.assessment = check(await account.request(`/items/${fixture.item.id}/assessments`, { method: 'POST', body: { ...fixture.assessment.answers, economic: {} } }), 201, 'Assessment parsial');
    assert.equal(fixture.assessment.status, 'PARTIAL_ECONOMIC'); assert.equal(fixture.assessment.score, null);
  }
  const profile = check(await account.request('/me'), 200, 'Profil fixture');
  const draft = await createListing(account, fixture.item, fixture.assessment, profile.city.id, type, fixture.item.title);
  return { ...fixture, listing: await approve(admin, draft) };
}
async function offer(fixture, account = bidder, exchangeItemId) {
  return check(await mutate(account, `/listings/${fixture.listing.id}/offers`, { expectedListingVersion: fixture.listing.version, listingRevisionId: fixture.listing.revision.id, clientRequestId: randomUUID(), ...(fixture.listing.type === 'RESELL' ? { priceIdr: 300000 } : {}), ...(exchangeItemId ? { exchangeItemId } : {}) }), 201, 'Buat Offer');
}
function acceptBody(o) { return { expectedVersion: o.version, offerRevisionId: o.currentRevision.id, listingRevisionId: o.listingRevisionId }; }
async function accept(o, account = owner) { return check(await mutate(account, `/offers/${o.id}/accept`, acceptBody(o)), 201, 'Terima Offer'); }
async function confirm(row, account, actorId, kind, itemId = row.snapshot.items[0].id, key = randomUUID()) {
  assert(row.requiredConfirmations.some((c) => c.actorId === actorId && c.itemId === itemId && c.kind === kind));
  return check(await mutate(account, `/transactions/${row.id}/confirmations`, { expectedVersion: row.version, itemId, kind }, key), 201, 'Konfirmasi serah terima');
}
async function getTx(row, account = owner) { return check(await account.request(`/transactions/${row.id}`), 200, 'Detail transaksi'); }
async function counts(id) { return { transfers: await db.ownershipTransfer.count({ where: { transactionId: id } }), passport: await db.passportEvent.count({ where: { sourceId: id } }), impact: await db.impactEvent.count({ where: { sourceId: id } }) }; }
let rollbackTrigger = false;
try {
  const spec = await (await fetch(base + '/api/docs-json')).json();
  for (const path of ['/offers/{id}/accept', '/transactions/{id}/confirmations', '/cases/{id}/evidence', '/admin/transactions/{id}/resolve-dispute']) assert(spec.paths['/api/v1' + path]);
  const sale = await listing();
  const privateRepair = await db.repairRecord.create({ data: { itemId: sale.item.id, createdById: ownerProfile.id, performedAt: new Date(), actionSummary: 'Membersihkan komponen sebelum transfer', privateNotes: 'Catatan privat pemilik lama', costIdr: 765432n, costKind: 'ACTUAL', outcome: 'SUCCEEDED', afterCondition: sale.item.conditionSummary, shareSummaryPublic: true, shareDetailsWithFutureOwner: false } });
  await db.item.update({ where: { id: sale.item.id }, data: { purchaseYear: 2020, originalPriceIdr: 1234567n, estimatedWeightGrams: 1500 } });
  const extraTicket = check(await owner.request(`/items/${sale.item.id}/media/tickets`, { method: 'POST', body: { fileName: 'privat.webp', mime: 'image/webp', bytes: photo.length } }), 201, 'Tiket foto privat');
  check(await owner.request(`/media/uploads/${extraTicket.ticketId}`, { method: 'PUT', body: photo, type: 'image/webp' }), 200, 'Unggah privat');
  // A privately stored photo is deliberately outside the accepted Listing snapshot.
  const hiddenPhoto = await db.mediaAsset.create({ data: { itemId: sale.item.id, uploadedById: ownerProfile.id, storageKey: extraTicket.ticketId + '.webp', mime: 'image/webp', bytes: photo.length, orderIndex: 1, processedAt: new Date() } });
  await db.uploadTicket.update({ where: { id: extraTicket.ticketId }, data: { status: 'CONSUMED', consumedAt: new Date() } });
  let saleOffer = await offer(sale);
  saleOffer = check(await mutate(owner, `/offers/${saleOffer.id}/counter`, { expectedVersion: saleOffer.version, priceIdr: 320000 }), 201, 'Counteroffer owner');
  const acceptanceKey = randomUUID(); const acceptancePayload = acceptBody(saleOffer);
  let saleTx = check(await mutate(bidder, `/offers/${saleOffer.id}/accept`, acceptancePayload, acceptanceKey), 201, 'Penerima Counteroffer menerima langsung');
  assert.equal(saleTx.finalPriceIdr, 320000);
  assert.equal(check(await mutate(bidder, `/offers/${saleOffer.id}/accept`, acceptancePayload, acceptanceKey), 201, 'Retry accept').id, saleTx.id);
  assert.equal((await mutate(bidder, `/offers/${saleOffer.id}/accept`, { ...acceptancePayload, expectedVersion: 999 }, acceptanceKey)).status, 409);
  assert.equal((await third.account.request(`/transactions/${saleTx.id}`)).status, 404);
  assert.equal((await guest.request(`/transactions/${saleTx.id}`)).status, 401);
  assert.equal((await admin.request(`/transactions/${saleTx.id}`)).status, 404);
  assert.equal((await owner.request(`/items/${sale.item.id}`, { method: 'PATCH', body: { expectedVersion: sale.item.version + 1, title: 'Perubahan saat reservasi' } })).status, 409);
  assert.equal((await mutate(bidder, `/transactions/${saleTx.id}/confirmations`, { expectedVersion: saleTx.version, itemId: sale.item.id, kind: 'HANDED_OVER' })).status, 403);
  saleTx = await confirm(saleTx, owner, ownerProfile.id, 'HANDED_OVER');
  assert.equal((await db.item.findUniqueOrThrow({ where: { id: sale.item.id } })).currentOwnerId, ownerProfile.id);
  const finalKey = randomUUID(); const finalPayload = { expectedVersion: saleTx.version, itemId: sale.item.id, kind: 'RECEIVED' };
  saleTx = check(await mutate(bidder, `/transactions/${saleTx.id}/confirmations`, finalPayload, finalKey), 201, 'Selesaikan Resell');
  assert.equal(saleTx.status, 'COMPLETED');
  check(await mutate(bidder, `/transactions/${saleTx.id}/confirmations`, finalPayload, finalKey), 201, 'Retry konfirmasi terakhir');
  assert.deepEqual(await counts(saleTx.id), { transfers: 1, passport: 1, impact: 7 });
  const newItem = check(await bidder.request(`/items/${sale.item.id}`), 200, 'Item owner baru');
  assert.equal(newItem.originalPriceIdr, null); assert.equal(newItem.purchaseYear, null);
  assert(!newItem.media.some((m) => m.id === hiddenPhoto.id));
  assert.equal((await bidder.request(`/media/${hiddenPhoto.id}/access`)).status, 404);
  assert.equal((await owner.request(`/items/${sale.item.id}`)).status, 404);
  const historical = check(await bidder.request(`/assessments/${sale.assessment.id}`), 200, 'Assessment historis owner baru');
  assert.equal(historical.answers, null); assert.equal(historical.economicSources, null); assert.equal(historical.isCurrent, false);
  const repairs = check(await bidder.request(`/items/${sale.item.id}/repairs`), 200, 'Riwayat Repair owner baru');
  const projectedRepair = repairs.find((r) => r.id === privateRepair.id);
  assert(projectedRepair); assert.equal(projectedRepair.costIdr, undefined); assert.equal(projectedRepair.privateNotes, undefined); assert.equal(projectedRepair.createdById, undefined);

  const competition = await listing(); const o1 = await offer(competition); const o2 = await offer(competition, third.account);
  check(await mutate(owner, `/offers/${o1.id}/accept`, { ...acceptBody(o1), expectedVersion: o1.version + 1 }), 409, 'Versi Offer lama ditolak');
  check(await owner.request(`/offers/${o1.id}/accept`, { method: 'POST', body: acceptBody(o1) }), 400, 'Idempotency-Key wajib');
  await db.offer.update({ where: { id: o1.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  check(await mutate(owner, `/offers/${o1.id}/accept`, acceptBody(o1)), 410, 'Offer kedaluwarsa ditolak');
  await db.offer.update({ where: { id: o1.id }, data: { expiresAt: new Date(Date.now() + 86400000) } });
  const raced = await Promise.all([mutate(owner, `/offers/${o1.id}/accept`, acceptBody(o1)), mutate(owner, `/offers/${o2.id}/accept`, acceptBody(o2))]);
  assert.equal(raced.filter((r) => r.status === 201).length, 1); assert.equal(raced.filter((r) => r.status === 409).length, 1);
  assert.equal(await db.transaction.count({ where: { listingId: competition.listing.id } }), 1);
  let racingTx = raced.find((r) => r.status === 201).payload.data;
  const remainingOffer = raced[0].status === 201 ? o2 : o1;
  assert.equal(check(await (remainingOffer.bidderId === third.id ? third.account : bidder).request(`/offers/${remainingOffer.id}`), 200, 'Offer lain tetap terbuka').status, 'PENDING');
  racingTx = check(await mutate(owner, `/transactions/${racingTx.id}/cancellation-requests`, { expectedVersion: racingTx.version, reason: 'Kedua pihak sepakat tidak melanjutkan.' }), 201, 'Ajukan batal');
  const winningAccount = racingTx.buyerOrRecipientId === third.id ? third.account : bidder;
  racingTx = check(await mutate(winningAccount, `/transactions/${racingTx.id}/cancellation-requests/${racingTx.cancellations[0].id}/respond`, { expectedVersion: racingTx.version, accept: true }), 201, 'Setujui batal');
  assert.equal(racingTx.status, 'CANCELLED'); assert.deepEqual(await counts(racingTx.id), { transfers: 0, passport: 0, impact: 0 });
  assert.equal(check(await guest.request(`/market/${competition.listing.id}`), 200, 'Listing aktif kembali').status, 'ACTIVE');

  const finishRace = await listing(); let finishTx = await accept(await offer(finishRace));
  finishTx = await confirm(finishTx, owner, ownerProfile.id, 'HANDED_OVER');
  finishTx = check(await mutate(owner, `/transactions/${finishTx.id}/cancellation-requests`, { expectedVersion: finishTx.version, reason: 'Permintaan batal bersamaan dengan penyelesaian.' }), 201, 'Batal untuk race akhir');
  const finishResults = await Promise.all([
    mutate(bidder, `/transactions/${finishTx.id}/confirmations`, { expectedVersion: finishTx.version, itemId: finishRace.item.id, kind: 'RECEIVED' }),
    mutate(bidder, `/transactions/${finishTx.id}/cancellation-requests/${finishTx.cancellations[0].id}/respond`, { expectedVersion: finishTx.version, accept: true }),
  ]);
  assert.deepEqual(finishResults.map((r) => r.status).sort(), [201, 409]);
  finishTx = await getTx(finishTx);
  const transferred = finishTx.status === 'COMPLETED';
  assert(['COMPLETED', 'CANCELLED'].includes(finishTx.status));
  assert.equal((await counts(finishTx.id)).transfers, transferred ? 1 : 0);
  assert.equal((await db.item.findUniqueOrThrow({ where: { id: finishRace.item.id } })).currentOwnerId, transferred ? bidderProfile.id : ownerProfile.id);
  const nextTx = await accept(remainingOffer); assert.notEqual(nextTx.id, racingTx.id);

  const donation = await listing('DONATE', owner, true); let donateTx = await accept(await offer(donation));
  donateTx = check(await mutate(owner, `/transactions/${donateTx.id}/cancellation-requests`, { expectedVersion: donateTx.version, reason: 'Meminta pembatalan sambil menunggu penyerahan.' }), 201, 'Permintaan batal tertunda');
  donateTx = await confirm(donateTx, owner, ownerProfile.id, 'HANDED_OVER');
  donateTx = await confirm(donateTx, bidder, bidderProfile.id, 'RECEIVED');
  assert.equal(donateTx.status, 'COMPLETED'); assert.equal(donateTx.cancellations[0].endReason, 'TRANSACTION_COMPLETED');
  assert.equal(await db.impactEvent.count({ where: { sourceId: donateTx.id, metric: 'CONFIRMED_SALE_VALUE' } }), 0);

  const exchange = await listing('EXCHANGE'); const offered = await createItem(bidder, 'electronics', 'Demo Item penukar tahap empat');
  const exchangeOffer = await offer(exchange, bidder, offered.item.id);
  assert.equal(exchangeOffer.exchangeSnapshot.itemRevision, offered.item.itemRevision);
  const competingExchange = await listing('EXCHANGE'); const exchangeOffer2 = await offer(competingExchange, bidder, offered.item.id);
  const exchangeRace = await Promise.all([mutate(owner, `/offers/${exchangeOffer.id}/accept`, acceptBody(exchangeOffer)), mutate(owner, `/offers/${exchangeOffer2.id}/accept`, acceptBody(exchangeOffer2))]);
  assert.equal(exchangeRace.filter((r) => r.status === 201).length, 1); assert.equal(exchangeRace.filter((r) => r.status === 409).length, 1);
  let exchangeTx = exchangeRace.find((r) => r.status === 201).payload.data;
  exchangeTx = await confirm(exchangeTx, owner, ownerProfile.id, 'HANDED_OVER', exchangeTx.snapshot.items[0].id);
  exchangeTx = await confirm(exchangeTx, bidder, bidderProfile.id, 'RECEIVED', exchangeTx.snapshot.items[0].id);
  exchangeTx = await confirm(exchangeTx, bidder, bidderProfile.id, 'HANDED_OVER', offered.item.id);
  for (const i of exchangeTx.snapshot.items) assert.equal((await db.item.findUniqueOrThrow({ where: { id: i.id } })).currentOwnerId, i.fromUserId);
  const blockedId = offered.item.id; assert.match(blockedId, /^[a-f0-9-]{36}$/);
  await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION stage4_test_transfer_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."itemId"::text = TG_ARGV[0] THEN RAISE EXCEPTION 'stage4 rollback injection'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER stage4_transfer_failure BEFORE INSERT ON "OwnershipTransfer" FOR EACH ROW EXECUTE FUNCTION stage4_test_transfer_failure('${blockedId}')`); rollbackTrigger = true;
  const exchangeFinalKey = randomUUID(); const exchangeFinalPayload = { expectedVersion: exchangeTx.version, itemId: offered.item.id, kind: 'RECEIVED' };
  assert.equal((await mutate(owner, `/transactions/${exchangeTx.id}/confirmations`, exchangeFinalPayload, exchangeFinalKey)).status, 500);
  assert.deepEqual(await counts(exchangeTx.id), { transfers: 0, passport: 0, impact: 0 });
  assert.equal(await db.handoverConfirmation.count({ where: { transactionId: exchangeTx.id } }), 3);
  for (const i of exchangeTx.snapshot.items) assert.equal((await db.item.findUniqueOrThrow({ where: { id: i.id } })).currentOwnerId, i.fromUserId);
  await db.$executeRawUnsafe('DROP TRIGGER stage4_transfer_failure ON "OwnershipTransfer"'); rollbackTrigger = false;
  exchangeTx = check(await mutate(owner, `/transactions/${exchangeTx.id}/confirmations`, exchangeFinalPayload, exchangeFinalKey), 201, 'Retry Exchange setelah rollback');
  assert.equal(exchangeTx.status, 'COMPLETED'); assert.equal((await counts(exchangeTx.id)).transfers, 2); assert.equal((await counts(exchangeTx.id)).passport, 2);

  const disputed = await listing(); let disputedTx = await accept(await offer(disputed));
  const msg = check(await bidder.request(`/conversations/${disputedTx.conversationId}/messages`, { method: 'POST', body: { clientMessageId: randomUUID(), body: 'Pesan bukti khusus kasus tahap empat.' } }), 201, 'Pesan bukti');
  disputedTx = await confirm(disputedTx, owner, ownerProfile.id, 'HANDED_OVER');
  disputedTx = check(await mutate(bidder, `/transactions/${disputedTx.id}/disputes`, { expectedVersion: disputedTx.version, reason: 'Kondisi saat diterima berbeda dari kesepakatan.' }), 201, 'Buka sengketa');
  const caseId = disputedTx.disputes[0].id;
  assert.equal((await mutate(bidder, `/transactions/${disputedTx.id}/confirmations`, { expectedVersion: disputedTx.version, itemId: disputed.item.id, kind: 'RECEIVED' })).status, 409);
  const ticket = check(await bidder.request(`/cases/${caseId}/media/tickets`, { method: 'POST', body: { fileName: 'bukti.webp', mime: 'image/webp', bytes: photo.length } }), 201, 'Tiket bukti');
  check(await bidder.request(`/media/uploads/${ticket.ticketId}`, { method: 'PUT', body: photo, type: 'image/webp' }), 200, 'Unggah bukti');
  const evidenceKey = randomUUID(); const evidenceBody = { note: 'Foto dan percakapan yang terkait kasus.', messageId: msg.id, ticketIds: [ticket.ticketId] };
  const evidence = check(await mutate(bidder, `/cases/${caseId}/evidence`, evidenceBody, evidenceKey), 201, 'Bukti gabungan');
  assert.equal(check(await mutate(bidder, `/cases/${caseId}/evidence`, evidenceBody, evidenceKey), 201, 'Retry bukti').id, evidence.id);
  assert.equal(await db.mediaAsset.count({ where: { evidenceId: evidence.id } }), 1);
  assert.equal((await third.account.request(`/cases/${caseId}`)).status, 404);
  assert.equal((await admin.request(`/media/${evidence.media[0].id}/access`)).status, 404);
  const queue = check(await admin.request('/admin/disputes'), 200, 'Antrean metadata'); assert(!('reason' in queue.find((c) => c.id === caseId)));
  const caseDetail = check(await owner.request(`/cases/${caseId}`), 200, 'Bukti peserta'); assert.equal(caseDetail.evidence.length, 2);
  const claims = await Promise.all([mutate(admin, `/admin/disputes/${caseId}/claim`, { expectedVersion: 1 }), mutate(secondAdmin.account, `/admin/disputes/${caseId}/claim`, { expectedVersion: 1 })]);
  assert.equal(claims.filter((r) => r.status === 201).length, 1);
  const assigned = claims[0].status === 201 ? admin : secondAdmin.account; const unassigned = claims[0].status === 201 ? secondAdmin.account : admin;
  assert.equal((await assigned.request(`/admin/cases/${caseId}/evidence`)).status, 403);
  assert.equal((await unassigned.request(`/admin/cases/${caseId}/evidence`)).status, 404);
  const grant = check(await mutate(assigned, `/admin/cases/${caseId}/evidence-access`, { reason: 'Memeriksa foto dan catatan sebelum putusan.' }), 201, 'Grant bukti beralasan');
  check(await assigned.request(`/admin/cases/${caseId}/evidence`), 200, 'Akses bukti ditugaskan');
  const signed = check(await assigned.request(`/media/${evidence.media[0].id}/access`), 200, 'URL foto kasus');
  assert.equal((await fetch(base + signed.url, { headers: { Cookie: assigned.cookieHeader() } })).status, 200);
  await db.caseAccessGrant.update({ where: { id: grant.grantId }, data: { expiresAt: new Date(Date.now() - 1) } });
  assert.equal((await fetch(base + signed.url, { headers: { Cookie: assigned.cookieHeader() } })).status, 404);
  check(await mutate(assigned, `/admin/cases/${caseId}/evidence-access`, { reason: 'Memperbarui akses bukti untuk putusan.' }), 201, 'Grant baru');
  const cancelDecision = { expectedVersion: disputedTx.version, caseId, decision: 'CANCEL', reason: 'Bukti mendukung pembatalan tanpa perpindahan owner.', evidenceIds: [evidence.id] };
  const decisionKey = randomUUID(); disputedTx = check(await mutate(assigned, `/admin/transactions/${disputedTx.id}/resolve-dispute`, cancelDecision, decisionKey), 201, 'Putusan CANCEL');
  check(await mutate(assigned, `/admin/transactions/${disputedTx.id}/resolve-dispute`, cancelDecision, decisionKey), 201, 'Retry putusan');
  assert.equal(disputedTx.status, 'CANCELLED'); assert.equal(disputedTx.confirmations.length, 1); assert.deepEqual(await counts(disputedTx.id), { transfers: 0, passport: 0, impact: 0 });

  async function adminResolution(decision) {
    const f = await listing('DONATE'); let t = await accept(await offer(f));
    t = check(await mutate(owner, `/transactions/${t.id}/disputes`, { expectedVersion: t.version, reason: 'Memerlukan pemeriksaan formal oleh admin.' }), 201, 'Sengketa fixture putusan');
    const c = t.disputes[0]; check(await mutate(admin, `/admin/disputes/${c.id}/claim`, { expectedVersion: c.version }), 201, 'Claim putusan');
    check(await mutate(admin, `/admin/cases/${c.id}/evidence-access`, { reason: 'Memeriksa alasan peserta sebelum menyelesaikan kasus.' }), 201, 'Akses putusan');
    const e = check(await admin.request(`/admin/cases/${c.id}/evidence`), 200, 'Bukti putusan');
    t = check(await mutate(admin, `/admin/transactions/${t.id}/resolve-dispute`, { expectedVersion: t.version, caseId: c.id, decision, reason: 'Putusan berdasarkan bukti peserta yang tercatat.', evidenceIds: [e[0].id] }), 201, `Putusan ${decision}`);
    return t;
  }
  const authorized = await adminResolution('COMPLETE_AUTHORIZED'); assert.equal(authorized.status, 'COMPLETED'); assert.equal(authorized.resolutionOrigin, 'ADMIN_AUTHORIZED');
  assert.equal((await db.passportEvent.findFirstOrThrow({ where: { sourceId: authorized.id } })).origin, 'ADMIN_AUTHORIZED');
  const continued = await adminResolution('CONTINUE'); assert.equal(continued.status, 'AWAITING_HANDOVER');

  const overdue = await listing('DONATE'); let overdueTx = await accept(await offer(overdue));
  await db.transaction.update({ where: { id: overdueTx.id }, data: { acceptedAt: new Date(Date.now() - 15 * 86400000), targetHandoverAt: new Date(Date.now() - 86400000) } });
  // Invoke the same maintenance job used by the running application, with isolated test DB configuration.
  const { TransactionsService } = await import('../../dist/modules/transactions/service.js'); const service = new TransactionsService(db);
  await service.reminders(); await service.reminders();
  assert.equal(await db.inAppNotification.count({ where: { eventKey: { startsWith: 'handover:' + overdueTx.id + ':' } } }), 4);
  overdueTx = await getTx(overdueTx); assert.equal(overdueTx.status, 'AWAITING_HANDOVER'); assert(overdueTx.overdueAt);
  const notifications = check(await bidder.request('/notifications'), 200, 'Pengingat penerima'); assert(notifications.some((n) => n.payload.transactionId === overdueTx.id));
  assert.equal((await third.account.request(`/notifications/${notifications[0].id}/read`, { method: 'POST' })).status, 404);
  check(await mutate(admin, `/admin/transactions/${overdueTx.id}/open-case`, { expectedVersion: overdueTx.version, reason: 'Target terlewati, memerlukan tindak lanjut formal.' }), 201, 'Kasus overdue');

  const closed = await extraUser(); const closedListing = await listing('DONATE', closed.account); const closedOffer = await offer(closedListing); let closedTx = await accept(closedOffer, closed.account);
  const closedResult = check(await closed.account.request('/me/close', { method: 'POST', body: { reason: 'Uji penutupan akun dengan transaksi aktif.' } }), 201, 'Tutup akun aktif');
  assert(closedResult.pendingTransactionIds.includes(closedTx.id)); closedTx = await getTx(closedTx, bidder); assert.equal(closedTx.status, 'DISPUTED');
  await db.user.update({ where: { id: closed.id }, data: { closedAt: new Date(Date.now() - 31 * 86400000) } });
  const { MaintenanceService } = await import('../../dist/infrastructure/jobs/maintenance.service.js');
  const { RetentionService } = await import('../../dist/modules/retention/service.js');
  const maintenance = new MaintenanceService(db, {}, service, new RetentionService(db, { remove: async () => { throw new Error('Aktif tidak boleh menghapus media.'); } }));
  await maintenance.purgeClosedAccounts(); assert.equal((await db.user.findUniqueOrThrow({ where: { id: closed.id } })).anonymizedAt, null);
  assert.equal((await db.item.findUniqueOrThrow({ where: { id: closedListing.item.id } })).reservedByTransactionId, closedTx.id);

  // Notification coverage shares these real transaction/admin flows.
  for (const [transactionId, type, count] of [
    [saleTx.id, 'TRANSACTION_STARTED', 2], [saleTx.id, 'HANDOVER_CONFIRMED', 1], [saleTx.id, 'TRANSACTION_COMPLETED', 2],
    [exchangeTx.id, 'TRANSACTION_COMPLETED', 2], [disputedTx.id, 'DISPUTE_OPENED', 1], [disputedTx.id, 'TRANSACTION_CANCELLED', 2],
    [authorized.id, 'TRANSACTION_COMPLETED', 2], [continued.id, 'DISPUTE_CONTINUED', 2], [overdueTx.id, 'DISPUTE_OPENED', 2],
    [closedTx.id, 'DISPUTE_OPENED', 1],
  ]) assert.equal(await db.inAppNotification.count({ where: { type, payload: { path: ['transactionId'], equals: transactionId } } }), count, type + ':' + transactionId);
  assert.equal(await db.inAppNotification.count({ where: { userId: closed.id } }), 0);

  await writeFile(resolve(process.cwd(), '../../.local/stage4-test-fixtures.json'), JSON.stringify({ sale: saleTx.id, donation: donateTx.id, exchange: exchangeTx.id, continued: continued.id, disputed: closedTx.id, cases: { resolved: caseId, active: closedTx.disputes[0].id }, credentialsFile: '.local/demo-credentials.json' }, null, 2));
  console.log('Tahap 4 smoke lulus: tiga jalur, counteraccept, konkurensi Item/Exchange, rollback terinjeksi, idempotensi, privasi owner/bukti, semua putusan admin, pengingat, overdue, dan retensi akun aktif.');
} finally {
  if (rollbackTrigger) await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS stage4_transfer_failure ON "OwnershipTransfer"');
  await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS stage4_test_transfer_failure()');
  await db.$disconnect();
}
