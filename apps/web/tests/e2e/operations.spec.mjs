import { chooseOption } from '../helpers/select.mjs';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { approve, check, createItem, createListing, login } from "../../../api/scripts/helpers/fixtures.mjs";

const mutate = (account, path, body) => account.request(path, { method: 'POST', body, extraHeaders: { 'Idempotency-Key': randomUUID() } });
async function browserAccount(browser, account, viewport) {
  const context = await browser.newContext({ viewport, baseURL: 'http://127.0.0.1:3002' });
  await context.addCookies(account.cookieHeader().split('; ').map((cookie) => { const index = cookie.indexOf('='); return { name: cookie.slice(0, index), value: cookie.slice(index + 1), domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }; }));
  return context;
}
async function confirm(page) { const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Simpan tindakan', exact: true }).click(); }
async function fits(page) {
  const layout = await page.evaluate(() => ({ fits: document.documentElement.scrollWidth <= innerWidth,
    overflow: [...document.body.querySelectorAll('*')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).slice(-12).map(node => ({ tag: node.tagName, className: typeof node.className === 'string' ? node.className : '', right: node.getBoundingClientRect().right, text: node.textContent?.slice(0, 80) })) }));
  expect(layout.fits, JSON.stringify(layout.overflow)).toBe(true);
}

test('Passport, Impact, penjelasan, laporan dan koreksi admin', async ({ browser }, info) => {
  const owner = await login('owner.demo@valora.local'); const member = await login('member.demo@valora.local'); const admin = await login('admin.demo@valora.local');
  const ownerProfile = check(await owner.request('/me'), 200, 'Profil'); const memberProfile = check(await member.request('/me'), 200, 'Profil penerima');
  const fixture = await createItem(owner, 'electronics', `Tahap lima browser ${info.project.name} ${randomUUID().slice(0, 6)}`);
  const listing = await approve(admin, await createListing(owner, fixture.item, fixture.assessment, ownerProfile.city.id, 'RESELL', fixture.item.title));
  const offer = check(await mutate(member, `/listings/${listing.id}/offers`, { clientRequestId: randomUUID(), expectedListingVersion: listing.version, listingRevisionId: listing.revision.id, priceIdr: 300000 }), 201, 'Offer');
  let transaction = check(await mutate(owner, `/offers/${offer.id}/accept`, { expectedVersion: offer.version, listingRevisionId: offer.listingRevisionId, offerRevisionId: offer.currentRevision.id }), 201, 'Accept');
  for (const confirmation of transaction.requiredConfirmations) transaction = check(await mutate(confirmation.actorId === ownerProfile.id ? owner : member, `/transactions/${transaction.id}/confirmations`, { expectedVersion: transaction.version, kind: confirmation.kind, itemId: confirmation.itemId }), 201, 'Complete');
  const referenceSource = 'Acuan browser ' + info.project.name + ' ' + randomUUID().slice(0, 6);
  check(await mutate(admin, '/admin/economic-references', { categoryCode: 'electronics', field: 'estimatedRepairCost', amountIdr: 50000, sourceNote: referenceSource, referenceDate: new Date().toISOString().slice(0, 10), region: 'Kota Bandung', reason: 'Acuan sintetis untuk memeriksa pengelolaan status melalui UI.' }), 201, 'Acuan browser');
  const opened = check(await mutate(owner, `/transactions/${transaction.id}/corrections`, { expectedVersion: transaction.version, reason: 'Peninjauan fakta riwayat melalui browser.' }), 201, 'Koreksi');
  const report = check(await owner.request('/reports', { method: 'POST', body: { targetType: 'TRANSACTION', targetId: transaction.id, reasonCode: 'HISTORY_REVIEW', details: 'Isi privat laporan transaksi untuk peninjauan admin.' } }), 201, 'Report');
  const ownerContext = await browserAccount(browser, owner, info.project.use.viewport);
  const adminContext = await browserAccount(browser, admin, info.project.use.viewport);
  const guestContext = await browser.newContext({ viewport: info.project.use.viewport, baseURL: 'http://127.0.0.1:3002' });
  const ownerPage = await ownerContext.newPage(); const page = await adminContext.newPage(); const publicPage = await guestContext.newPage(); const pageErrors = [];
  for (const current of [ownerPage, page, publicPage]) current.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await ownerPage.goto('/app/impact'); await expect(ownerPage.getByRole('heading', { name: 'Kontribusi yang kamu catat.' })).toBeVisible(); await expect(ownerPage.locator('.impact-metric')).toHaveCount(5); await chooseOption(ownerPage.getByLabel('Periode laporan (Asia/Jakarta)'), '90'); await fits(ownerPage);
    await ownerPage.goto(`/app/barang/${fixture.item.id}/penilaian/${fixture.assessment.id}`); await ownerPage.getByRole('button', { name: 'Jelaskan hasil penilaian' }).click(); await expect(ownerPage.getByText('Penjelasan dari rubrik', { exact: false })).toBeVisible(); await fits(ownerPage);
    await publicPage.goto(`/passport/${fixture.item.id}`); await expect(publicPage.getByRole('heading', { name: fixture.item.title, exact: true })).toBeVisible(); await expect(publicPage.getByRole('heading', { name: 'Berpindah melalui Resell · konfirmasi kedua pihak' })).toBeVisible(); await fits(publicPage); await publicPage.screenshot({ path: `../../.local/stage5-evidence/passport-${info.project.name}.png`, fullPage: true });
    await publicPage.getByRole('button', { name: 'QR Passport', exact: true }).click();
    await expect(publicPage.getByRole('dialog').getByLabel('Tautan Passport publik')).toHaveValue(`http://127.0.0.1:3002/passport/${fixture.item.id}`);
    await expect(publicPage.getByRole('dialog').getByRole('img', { name: 'QR untuk membuka Passport publik barang' })).toBeVisible();
    await publicPage.keyboard.press('Escape');
    await page.goto('/app/admin'); await expect(page.getByRole('heading', { name: 'Operasi Valora' })).toBeVisible(); await expect(page.locator('.impact-metric')).toHaveCount(5); await fits(page);
    await page.goto(`/app/admin/laporan/${report.id}`); await page.getByLabel('Alasan tindakan').fill('Mengambil laporan untuk memeriksa konteks transaksi.'); await page.getByRole('button', { name: 'Ambil penugasan', exact: true }).click(); await confirm(page); await expect(page.getByRole('dialog')).not.toBeVisible(); await page.getByRole('button', { name: 'Buka isi laporan', exact: true }).click(); await confirm(page); await expect(page.getByText('Isi privat laporan transaksi untuk peninjauan admin.', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Selesaikan laporan', exact: true }).click(); await confirm(page); await expect(page.getByRole('dialog')).not.toBeVisible(); await fits(page);
    await page.goto(`/app/admin/koreksi/${opened.id}`); await page.getByLabel('Alasan tindakan').fill('Mengambil kasus koreksi sesuai bukti yang dilaporkan.'); await page.getByRole('button', { name: 'Ambil penugasan', exact: true }).click(); await confirm(page); await expect(page.getByRole('dialog')).not.toBeVisible(); await page.getByRole('button', { name: 'Buka bukti privat', exact: true }).click(); await confirm(page); await expect(page.getByRole('heading', { name: 'Konteks dan bukti' })).toBeVisible();
    await page.getByLabel('Catatan bukti', { exact: true }).fill('Bukti privat tambahan yang tidak masuk ke Passport.'); await page.getByLabel('Foto bukti', { exact: true }).setInputFiles(fileURLToPath(new URL("../../public/images/keyboard.webp", import.meta.url))); await page.getByRole('button', { name: 'Simpan bukti', exact: true }).click(); await expect(page.getByText('Bukti privat tambahan yang tidak masuk ke Passport.', { exact: true })).toBeVisible(); await expect(page.getByAltText('Foto bukti koreksi privat')).toBeVisible();
    await page.getByText('Koreksi estimasi berat atau nilai Resell', { exact: true }).click(); await page.getByLabel('Nilai total yang benar').fill('2200'); await page.locator('#impact-correct-reason').fill('Estimasi berat sebenarnya dua ribu dua ratus gram.'); await page.getByRole('button', { name: 'Simpan koreksi Impact', exact: true }).click(); await confirm(page); await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByText('Visibilitas Passport · PUBLIC', { exact: true }).click(); await chooseOption(page.getByLabel('Visibilitas publik'), 'LIMITED'); await page.locator(`#visibility-reason-${fixture.item.id}`).fill('Batasi riwayat selama pemeriksaan fakta publik.'); await page.getByRole('button', { name: 'Simpan visibilitas', exact: true }).click(); await confirm(page); await expect(page.getByRole('dialog')).not.toBeVisible(); await publicPage.reload(); await expect(publicPage.getByText('Riwayat publik sedang dibatasi selama peninjauan.')).toBeVisible(); await expect(publicPage.locator('.passport-timeline')).toHaveCount(0);
    await chooseOption(page.getByLabel('Visibilitas publik'), 'PUBLIC'); await page.getByRole('button', { name: 'Simpan visibilitas', exact: true }).click(); await confirm(page); await expect(page.getByRole('dialog')).not.toBeVisible(); await publicPage.reload(); await expect(publicPage.locator('.passport-timeline')).toBeVisible();
    await fits(page); await page.screenshot({ path: `../../.local/stage5-evidence/case-${info.project.name}.png`, fullPage: true });
    await page.locator('#decision-reason').fill('Bukti menunjukkan transfer salah catat dan perlu pembalikan.');
    let abortOnce = true;
    await page.route(`**/api/v1/admin/transactions/${transaction.id}/correct`, async (route) => { if (abortOnce) { abortOnce = false; await route.fetch(); await route.abort('failed'); } else await route.continue(); });
    await page.getByRole('button', { name: 'Balikkan kepemilikan', exact: true }).click(); await confirm(page); await expect(page.getByRole('dialog').getByRole('button', { name: 'Periksa ulang tindakan', exact: true })).toBeVisible(); await page.getByRole('dialog').getByRole('button', { name: 'Periksa ulang tindakan', exact: true }).click(); await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(page.getByText('Hasil: OWNERSHIP_REVERSED', { exact: false })).toBeVisible();
    const current = check(await owner.request(`/items/${fixture.item.id}`), 200, 'Owner restored'); expect(current.id).toBe(fixture.item.id);
    await page.goto('/app/admin/pengguna'); await expect(page.getByRole('heading', { name: 'Pengguna', exact: true })).toBeVisible(); await page.getByLabel('Cari nama atau email').fill('owner.demo@valora.local'); await page.getByRole('button', { name: 'Cari', exact: true }).click(); await expect(page.getByText('owner.demo@valora.local · USER')).toBeVisible(); await fits(page);
    await page.goto('/app/admin/rubrik'); await expect(page.getByRole('heading', { name: 'Kategori, rubrik, dan acuan' })).toBeVisible(); await expect(page.getByLabel('Versi dasar untuk draft baru')).toBeVisible(); await fits(page);
    const referenceRow = page.getByRole('listitem').filter({ hasText: referenceSource });
    await referenceRow.getByText('Nonaktifkan acuan', { exact: true }).click(); await referenceRow.getByLabel('Alasan tindakan').fill('Acuan sintetis ini tidak dipakai untuk penilaian baru.'); await referenceRow.getByRole('button', { name: 'Simpan status acuan', exact: true }).click(); await confirm(page); await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(referenceRow.getByText('Aktifkan kembali acuan', { exact: true })).toBeVisible();
    await referenceRow.getByText('Aktifkan kembali acuan', { exact: true }).click(); await referenceRow.getByLabel('Alasan tindakan').fill('Acuan sintetis diaktifkan setelah peninjauan sumber.'); await referenceRow.getByRole('button', { name: 'Simpan status acuan', exact: true }).click(); await confirm(page); await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(referenceRow.getByText('Nonaktifkan acuan', { exact: true })).toBeVisible(); await fits(page);
    await page.goto('/app/admin/analitik'); await expect(page.getByRole('heading', { name: 'Aktivitas platform' })).toBeVisible(); await expect(page.locator('.impact-metric')).toHaveCount(5); await fits(page);
    await page.goto('/app/admin/audit'); await expect(page.getByRole('heading', { name: 'Audit dan retensi' })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Hasil pemeliharaan' })).toBeVisible(); await fits(page);
    await publicPage.goto('/impact'); await expect(publicPage.locator('.impact-metric')).toHaveCount(5); await fits(publicPage);
    expect(pageErrors).toEqual([]);
  } finally { await ownerContext.close(); await adminContext.close(); await guestContext.close(); }
});
