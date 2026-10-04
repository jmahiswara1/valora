import { chooseOption } from '../helpers/select.mjs';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { login, credentials, createItem, createListing, approve, check } from "../../../api/scripts/helpers/fixtures.mjs";

const mutate = (account, path, body) => account.request(path, { method: 'POST', body, extraHeaders: { 'Idempotency-Key': randomUUID() } });
async function browserLogin(browser, email, viewport) {
  const context = await browser.newContext({ viewport, baseURL: 'http://127.0.0.1:3002' });
  const csrf = await context.request.get('http://127.0.0.1:4001/api/v1/auth/csrf');
  const response = await context.request.post('http://127.0.0.1:4001/api/v1/auth/login', { headers: { 'X-CSRF-Token': (await csrf.json()).data.token }, data: { email, password: credentials.password } });
  expect(response.status()).toBe(201);
  return context;
}
async function fit(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function approveDialog(page, button = 'Simpan konfirmasi') {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toBeFocused();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: button, exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test('Exchange, pemulihan jaringan, bukti privat dan putusan admin', async ({ browser }, testInfo) => {
  const owner = await login('owner.demo@valora.local');
  const member = await login('member.demo@valora.local');
  const admin = await login('admin.demo@valora.local');
  const profile = check(await owner.request('/me'), 200, 'Profil');
  const title = `Browser ${testInfo.project.name} ${randomUUID().slice(0, 8)}`;
  async function published(type, label) {
    const fixture = await createItem(owner, 'electronics', label);
    const draft = await createListing(owner, fixture.item, fixture.assessment, profile.city.id, type, label);
    return { ...fixture, listing: await approve(admin, draft) };
  }
  async function offer(fixture, exchangeItemId) {
    return check(await mutate(member, `/listings/${fixture.listing.id}/offers`, { clientRequestId: randomUUID(), expectedListingVersion: fixture.listing.version, listingRevisionId: fixture.listing.revision.id, ...(exchangeItemId ? { exchangeItemId } : { priceIdr: 300000 }) }), 201, 'Offer browser');
  }
  const exchange = await published('EXCHANGE', title + ' Exchange');
  const other = await createItem(member, 'electronics', title + ' penukar');
  await offer(exchange, other.item.id);
  const contexts = await Promise.all(['owner', 'member', 'admin'].map((name) => browserLogin(browser, name + '.demo@valora.local', testInfo.project.use.viewport)));
  const [sellerPage, buyerPage, adminPage] = await Promise.all(contexts.map((c) => c.newPage()));
  const errors = [];
  for (const page of [sellerPage, buyerPage, adminPage]) page.on('pageerror', (e) => errors.push(e.message));
  try {
    await sellerPage.goto('/app/penawaran');
    const card = sellerPage.locator('.offer-card').filter({ hasText: exchange.item.title });
    await card.getByRole('button', { name: 'Terima penawaran', exact: true }).click();
    await approveDialog(sellerPage, 'Terima dan reservasi barang');
    await sellerPage.waitForURL(/\/app\/transaksi\/[^/]+$/);
    const transactionUrl = sellerPage.url();
    const transactionId = transactionUrl.split('/').at(-1);
    await expect(sellerPage.getByRole('heading', { name: 'Konfirmasi serah terima' })).toBeVisible();
    await fit(sellerPage);
    await sellerPage.screenshot({ path: `../../.local/stage4-exchange-${testInfo.project.name}.png`, fullPage: true });
    let lost = false;
    await sellerPage.route('**/api/v1/transactions/*/confirmations', async (route) => {
      if (!lost) { lost = true; await route.fetch(); await route.abort('failed'); }
      else await route.continue();
    });
    await sellerPage.getByRole('button', { name: 'Konfirmasi penyerahan', exact: true }).click();
    const dialog = sellerPage.getByRole('dialog');
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Simpan konfirmasi', exact: true }).click();
    await expect(dialog.getByText('Hasil tindakan belum dapat dipastikan.', { exact: false })).toBeVisible();
    const stored = await sellerPage.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('valora-action:')).map((key) => Object.keys(JSON.parse(sessionStorage.getItem(key))).sort()));
    expect(stored.length).toBeGreaterThan(0); for (const fields of stored) expect(fields).toEqual(['actorId', 'key', 'operation']);
    await dialog.getByRole('button', { name: 'Periksa ulang tindakan' }).click();
    await expect(dialog).not.toBeVisible();
    await buyerPage.goto(transactionUrl);
    await buyerPage.getByRole('button', { name: 'Konfirmasi penerimaan', exact: true }).click();
    await approveDialog(buyerPage);
    await buyerPage.getByRole('button', { name: 'Konfirmasi penyerahan', exact: true }).click();
    await approveDialog(buyerPage);
    await sellerPage.reload();
    lost = false;
    await sellerPage.getByRole('button', { name: 'Konfirmasi penerimaan', exact: true }).click();
    await sellerPage.getByRole('dialog').getByRole('checkbox').check();
    await sellerPage.getByRole('dialog').getByRole('button', { name: 'Simpan konfirmasi', exact: true }).click();
    await expect(sellerPage.getByRole('dialog').getByText('Hasil tindakan belum dapat dipastikan.', { exact: false })).toBeVisible();
    await sellerPage.reload();
    await sellerPage.getByRole('button', { name: 'Periksa ulang tindakan', exact: true }).click();
    await expect(sellerPage.getByRole('button', { name: 'Periksa ulang tindakan', exact: true })).not.toBeVisible();
    await expect(sellerPage.getByText('Kepemilikan telah berpindah.', { exact: false })).toBeVisible();
    expect(check(await owner.request(`/transactions/${transactionId}`), 200, 'Exchange selesai').confirmations).toHaveLength(4);

    const sale = await published('RESELL', title + ' Sengketa');
    const saleOffer = await offer(sale);
    const tx = check(await mutate(owner, `/offers/${saleOffer.id}/accept`, { expectedVersion: saleOffer.version, offerRevisionId: saleOffer.currentRevision.id, listingRevisionId: saleOffer.listingRevisionId }), 201, 'Accept untuk kasus');
    await mutate(member, `/conversations/${tx.conversationId}/messages`, { clientMessageId: randomUUID(), body: 'Foto kondisi barang untuk pemeriksaan browser.' });
    await sellerPage.goto(`/app/transaksi/${tx.id}`);
    await sellerPage.getByRole('button', { name: 'Buka sengketa', exact: true }).click();
    await sellerPage.getByRole('dialog').getByLabel('Alasan', { exact: true }).fill('Kondisi barang perlu diperiksa sebelum serah terima.');
    await sellerPage.getByRole('dialog').getByRole('checkbox').check();
    await sellerPage.getByRole('dialog').getByRole('button', { name: 'Buka sengketa', exact: true }).click();
    await expect(sellerPage.getByRole('dialog')).not.toBeVisible();
    await sellerPage.getByLabel('Catatan bukti', { exact: true }).fill('Bukti privat dari pemeriksaan browser.');
    await chooseOption(sellerPage.getByLabel('Pesan dari percakapan terkait (opsional)', { exact: true }), { label: 'Foto kondisi barang untuk pemeriksaan browser.' });
    await sellerPage.getByLabel('Foto bukti (maksimal empat)', { exact: true }).setInputFiles(fileURLToPath(new URL("../../public/images/keyboard.webp", import.meta.url)));
    await sellerPage.getByRole('button', { name: 'Simpan bukti', exact: true }).click();
    await expect(sellerPage.locator('.evidence-entry').filter({ hasText: 'Bukti privat dari pemeriksaan browser.' })).toBeVisible();
    await fit(sellerPage);
    await sellerPage.screenshot({ path: `../../.local/stage4-evidence-${testInfo.project.name}.png`, fullPage: true });
    const disputed = check(await owner.request(`/transactions/${tx.id}`), 200, 'Kasus browser');
    await adminPage.goto(`/app/admin/sengketa/${disputed.disputes[0].id}`);
    await adminPage.getByRole('button', { name: 'Ambil kasus', exact: true }).click();
    await adminPage.getByLabel('Alasan akses bukti atau percakapan').fill('Memeriksa bukti untuk putusan pengujian browser.');
    await adminPage.getByRole('button', { name: 'Buka bukti dengan audit', exact: true }).click();
    await expect(adminPage.getByRole('heading', { name: 'Bukti kasus', exact: true })).toBeVisible();
    await adminPage.getByRole('button', { name: 'Buka chat dengan audit', exact: true }).click();
    await expect(adminPage.getByRole('heading', { name: 'Percakapan terkait', exact: true })).toBeVisible();
    await adminPage.getByRole('group', { name: 'Rujukan bukti untuk putusan' }).getByRole('checkbox').first().check();
    await chooseOption(adminPage.getByLabel('Tindakan', { exact: true }), 'CANCEL');
    await adminPage.getByLabel('Alasan putusan', { exact: true }).fill('Kedua peserta belum menyerahkan barang. Batalkan sesuai bukti.');
    await fit(adminPage);
    await adminPage.screenshot({ path: `../../.local/stage4-admin-${testInfo.project.name}.png`, fullPage: true });
    await adminPage.getByRole('button', { name: 'Tinjau putusan', exact: true }).click();
    await approveDialog(adminPage, 'Simpan putusan');
    await expect(adminPage.getByText('Kasus selesai', { exact: true })).toBeVisible();
    await buyerPage.goto(`/app/transaksi/${tx.id}`);
    await expect(buyerPage.getByText('Reservasi telah dilepas.', { exact: false })).toBeVisible();
    await buyerPage.goto('/app/transaksi');
    await chooseOption(buyerPage.getByLabel('Status transaksi'), 'COMPLETED');
    await expect(buyerPage.locator('.transaction-row').filter({ hasText: exchange.item.title })).toBeVisible();
    await fit(buyerPage);
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map((c) => c.close())); }
});
