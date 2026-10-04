import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

const local = dotenv.parse(await readFile('.env.local'));
process.env.VALORA_SMOKE_URL = 'http://127.0.0.1:4003';
const server = spawn(process.execPath, ['dist/main.js'], { env: { ...process.env, ...local, API_PORT: '4003' }, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
server.stderr.on('data', (chunk) => process.stderr.write(chunk));
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('API fixture tahap 5 berhenti.');
    try { if ((await fetch(process.env.VALORA_SMOKE_URL + '/api/v1/categories')).ok) { ready = true; break; } } catch { /* Startup pending. */ }
    await new Promise((done) => setTimeout(done, 150));
  }
  if (!ready) throw new Error('API fixture tahap 5 tidak siap.');
  const { login, check, createItem, createListing, approve } = await import("../helpers/fixtures.mjs");
  const owner = await login('owner.demo@valora.local'); const member = await login('member.demo@valora.local'); const admin = await login('admin.demo@valora.local');
  const profile = check(await owner.request('/me'), 200, 'Profil demo');
  const mutate = (account, path, body) => account.request(path, { method: 'POST', body, extraHeaders: { 'Idempotency-Key': randomUUID() } });
  const suffix = randomUUID().slice(0, 6); const fixtures = { createdAt: new Date().toISOString(), synthetic: true, accounts: { sender: 'owner.demo@valora.local', recipient: 'member.demo@valora.local', admin: 'admin.demo@valora.local' }, routes: { impact: '/impact', myImpact: '/app/impact', admin: '/app/admin', rubrics: '/app/admin/rubrik', analytics: '/app/admin/analitik', audit: '/app/admin/audit' }, transactions: {} };
  for (const type of ['RESELL', 'DONATE', 'EXCHANGE']) {
    const fixture = await createItem(owner, 'electronics', `Demo tahap 5 ${type} ${suffix}`);
    fixture.item = check(await owner.request(`/items/${fixture.item.id}`, { method: 'PATCH', body: { expectedVersion: fixture.item.version, estimatedWeightGrams: type === 'DONATE' ? null : 1500 } }), 200, 'Berat demo');
    if (type === 'DONATE') fixture.assessment = check(await owner.request(`/items/${fixture.item.id}/assessments`, { method: 'POST', body: { ...fixture.assessment.answers, economic: {} } }), 201, 'Donate parsial');
    if (type === 'RESELL') {
      check(await owner.request(`/items/${fixture.item.id}/repairs`, { method: 'POST', body: { expectedItemVersion: fixture.item.version, performedAt: new Date().toISOString(), actionSummary: 'Membersihkan konektor dan menguji fungsi tombol.', afterCondition: fixture.item.conditionSummary, outcome: 'SUCCEEDED', privateNotes: 'Catatan sintetis privat untuk demonstrasi akses.', costIdr: 25000, costKind: 'ACTUAL', shareSummaryPublic: true, shareDetailsWithFutureOwner: false } }), 201, 'Repair demo');
      fixture.item = check(await owner.request(`/items/${fixture.item.id}`), 200, 'Item setelah Repair');
    }
    const listing = await approve(admin, await createListing(owner, fixture.item, fixture.assessment, profile.city.id, type, fixture.item.title));
    const other = type === 'EXCHANGE' ? await createItem(member, 'electronics', `Barang penukar privat ${suffix}`) : null;
    if (other) other.item = check(await member.request(`/items/${other.item.id}`, { method: 'PATCH', body: { expectedVersion: other.item.version, estimatedWeightGrams: 900 } }), 200, 'Berat penukar');
    const offer = check(await mutate(member, `/listings/${listing.id}/offers`, { expectedListingVersion: listing.version, listingRevisionId: listing.revision.id, clientRequestId: randomUUID(), ...(type === 'RESELL' ? { priceIdr: 300000 } : {}), ...(other ? { exchangeItemId: other.item.id } : {}) }), 201, 'Offer demo');
    let row = check(await mutate(owner, `/offers/${offer.id}/accept`, { expectedVersion: offer.version, offerRevisionId: offer.currentRevision.id, listingRevisionId: offer.listingRevisionId }), 201, 'Reservasi demo');
    for (const confirmation of row.requiredConfirmations) row = check(await mutate(confirmation.actorId === profile.id ? owner : member, `/transactions/${row.id}/confirmations`, { expectedVersion: row.version, itemId: confirmation.itemId, kind: confirmation.kind }), 201, 'Serah terima demo');
    const entry = { transactionId: row.id, itemId: fixture.item.id, offeredItemId: other?.item.id ?? null, status: row.status, assessmentId: fixture.assessment.id, path: '/app/transaksi/' + row.id, passport: '/passport/' + fixture.item.id, ownerPassport: '/app/barang/' + fixture.item.id + '/passport', ...(other ? { privateExchangePassport: '/passport/' + other.item.id } : {}) };
    if (type === 'RESELL') {
      const correction = check(await mutate(owner, `/transactions/${row.id}/corrections`, { expectedVersion: row.version, reason: 'Fixture sintetis untuk meninjau estimasi berat tanpa mengubah kepemilikan.' }), 201, 'Kasus koreksi demo');
      entry.correction = '/app/koreksi/' + correction.id;
      entry.adminCorrection = '/app/admin/koreksi/' + correction.id;
    }
    if (type === 'DONATE') {
      const report = check(await owner.request('/reports', { method: 'POST', body: { targetType: 'TRANSACTION', targetId: row.id, reasonCode: 'HISTORY_REVIEW', details: 'Laporan sintetis untuk memperagakan penugasan dan akses privat laporan.' } }), 201, 'Laporan demo');
      entry.adminReport = '/app/admin/laporan/' + report.id;
      const correction = check(await mutate(admin, `/transactions/${row.id}/corrections`, { expectedVersion: row.version, reason: 'Demo pembatasan riwayat Passport selama peninjauan.' }), 201, 'Kasus pembatasan');
      check(await mutate(admin, `/admin/correction-cases/${correction.id}/access`, { reason: 'Membuka bukti sintetis untuk demonstrasi pembatasan Passport.' }), 201, 'Grant pembatasan');
      const passport = check(await member.request(`/items/${fixture.item.id}/passport`), 200, 'Versi Passport');
      check(await mutate(admin, `/admin/passport/${fixture.item.id}/visibility`, { scopeType: 'CORRECTION', caseId: correction.id, expectedVersion: passport.version, visibility: 'LIMITED', reason: 'Riwayat sintetis dibatasi sampai peninjauan selesai.' }), 201, 'Passport LIMITED');
      check(await mutate(admin, '/admin/retention/holds', { scopeType: 'CORRECTION', scopeId: correction.id, reason: 'Tahan bukti sintetis untuk latihan peninjauan retensi.', reviewAt: new Date(Date.now() + 7 * 86400000).toISOString() }), 201, 'Hold demo');
      entry.adminCorrection = '/app/admin/koreksi/' + correction.id;
    }
    fixtures.transactions[type] = entry;
    check(await owner.request(`/assessments/${fixture.assessment.id}/explain`, { method: 'POST' }), 201, 'Penjelasan template demo');
  }
  const rubric = check(await admin.request('/categories/electronics/rubric'), 200, 'Rubrik demo');
  const draft = check(await mutate(admin, '/admin/rubrics/drafts', { baseVersionId: rubric.id, reason: 'Draft sintetis untuk demonstrasi fixture publikasi rubrik.' }), 201, 'Draft rubrik demo');
  fixtures.rubricDraft = { id: draft.id, tests: check(await admin.request(`/admin/rubrics/drafts/${draft.id}/tests`), 200, 'Fixture rubrik') };
  await writeFile(new URL("../../../../.local/stage5-demo-fixtures.json", import.meta.url), JSON.stringify(fixtures, null, 2));
  console.log('Fixture tahap 5 siap: tiga transfer selesai, Passport publik/terbatas, Exchange privat, Repair, Impact, kasus koreksi, laporan, draft rubrik, dan hold. Rute tersimpan di .local/stage5-demo-fixtures.json.');
} finally { server.kill(); }
