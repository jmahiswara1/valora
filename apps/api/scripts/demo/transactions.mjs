import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

const local = dotenv.parse(await readFile('.env.local'));
process.env.VALORA_SMOKE_URL = 'http://127.0.0.1:4003';
const server = spawn(process.execPath, ['dist/main.js'], { env: { ...process.env, ...local, API_PORT: '4003' }, stdio: ['ignore', 'ignore', 'pipe'] });
server.stderr.on('data', (chunk) => process.stderr.write(chunk));
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('API fixture demo berhenti.');
    try { if ((await fetch(process.env.VALORA_SMOKE_URL + '/api/v1/categories')).ok) { ready = true; break; } } catch { /* Startup pending. */ }
    await new Promise((done) => setTimeout(done, 150));
  }
  if (!ready) throw new Error('API fixture demo tidak siap.');
  const { login, check, createItem, createListing, approve } = await import("../helpers/fixtures.mjs");
  const owner = await login('owner.demo@valora.local'); const member = await login('member.demo@valora.local'); const admin = await login('admin.demo@valora.local');
  const profile = check(await owner.request('/me'), 200, 'Profil demo');
  const mutate = (account, path, body) => account.request(path, { method: 'POST', body, extraHeaders: { 'Idempotency-Key': randomUUID() } });
  const fixtures = {};
  for (const type of ['RESELL', 'DONATE', 'EXCHANGE']) {
    const fixture = await createItem(owner, 'electronics', `Demo tahap 4 ${type} ${randomUUID().slice(0, 6)}`);
    if (type === 'DONATE') fixture.assessment = check(await owner.request(`/items/${fixture.item.id}/assessments`, { method: 'POST', body: { ...fixture.assessment.answers, economic: {} } }), 201, 'Donate parsial');
    const submitted = await createListing(owner, fixture.item, fixture.assessment, profile.city.id, type, fixture.item.title);
    const listing = await approve(admin, submitted);
    const other = type === 'EXCHANGE' ? await createItem(member, 'electronics', 'Demo Item penukar ' + randomUUID().slice(0, 6)) : null;
    const offer = check(await mutate(member, `/listings/${listing.id}/offers`, { expectedListingVersion: listing.version, listingRevisionId: listing.revision.id, clientRequestId: randomUUID(), ...(type === 'RESELL' ? { priceIdr: 300000 } : {}), ...(other ? { exchangeItemId: other.item.id } : {}) }), 201, 'Offer demo');
    let row = check(await mutate(owner, `/offers/${offer.id}/accept`, { expectedVersion: offer.version, offerRevisionId: offer.currentRevision.id, listingRevisionId: offer.listingRevisionId }), 201, 'Reservasi demo');
    if (type === 'DONATE') row = check(await mutate(owner, `/transactions/${row.id}/confirmations`, { expectedVersion: row.version, itemId: fixture.item.id, kind: 'HANDED_OVER' }), 201, 'Konfirmasi pertama demo');
    fixtures[type] = { transactionId: row.id, itemId: fixture.item.id, offeredItemId: other?.item.id ?? null, status: row.status, path: '/app/transaksi/' + row.id };
  }
  await writeFile(new URL("../../../../.local/stage4-demo-fixtures.json", import.meta.url), JSON.stringify(fixtures, null, 2));
  console.log('Fixture demo Resell, Donate parsial, dan Exchange siap. Rute tersimpan di .local/stage4-demo-fixtures.json.');
} finally { server.kill(); }
