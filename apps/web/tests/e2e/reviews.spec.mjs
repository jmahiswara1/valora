import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const city = { id: id(1), code: '3571', name: 'Kota Kediri', provinceName: 'Jawa Timur' };
const person = n => ({ id: id(n), displayName: n === 2 ? 'Pemilik Valora' : 'Pengguna Valora', profilePhotoUrl: null });
const user = n => ({ ...person(n), email: 'review@demo.valora.local', city, role: 'USER', status: 'ACTIVE', emailVerifiedAt: new Date().toISOString(), profilePhotoPublic: false });
const review = () => ({ id: id(20), author: person(3), subjectId: id(2), rating: 5, comment: 'Barang sesuai informasi. Komunikasi dan serah terima berjalan baik.', type: 'RESELL', createdAt: new Date().toISOString(), version: 1, visibility: 'VISIBLE', reply: null });
const listing = n => ({ id: id(n), type: 'RESELL', status: 'ACTIVE', version: 1, owner: { ...person(2), city }, publishedAt: new Date().toISOString(), revision: { id: id(500 + n), itemId: id(800 + n), title: `Barang pilihan ${n}`, description: 'Barang untuk digunakan kembali.', categoryCode: 'electronics', categoryName: 'Elektronik', media: [{ id: id(900 + n), url: '/images/keyboard.webp', orderIndex: 0 }], city, condition: 75, score: 80, scoreLabel: 'Baik', askingPriceIdr: 150000, handoverMethods: ['MEETUP'], conditionDisclosure: 'Bekas pemakaian ringan.' } });
const transaction = () => ({ id: id(10), listingId: id(40), offerId: id(41), type: 'RESELL', status: 'COMPLETED', sellerOrDonorId: id(2), buyerOrRecipientId: id(3), finalPriceIdr: 150000, snapshot: { parties: [person(2), person(3)], items: [{ id: id(50), title: 'Keyboard fixture', description: 'Keyboard untuk digunakan kembali.', conditionSummary: 'Baik', mediaIds: [], fromUserId: id(2), toUserId: id(3) }], handoverMethods: ['MEETUP'] }, acceptedAt: new Date().toISOString(), targetHandoverAt: new Date().toISOString(), completedAt: new Date().toISOString(), correctedAt: null, overdueAt: null, cancellations: [], confirmations: [], disputes: [], corrections: [], requiredConfirmations: [], conversationId: null, version: 5 });
async function mock(page, options = {}) {
  const state = { guest: false, actor: 3, reviews: [], listings: [], failProfile: false, unavailable: false, expired: false, commitThenFail: false, reports: [], writes: [], name: 'Pemilik Valora', ...options };
  const ok = (route, data, meta) => route.fulfill({ json: { data, ...(meta ? { meta } : {}) } });
  const error = (route, status = 503) => route.fulfill({ status, json: { error: { code: status === 404 ? 'NOT_FOUND' : 'DEPENDENCY_UNAVAILABLE', message: 'Respons belum tersedia.' } } });
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.slice(7), method = req.method();
    if (path === '/auth/session') return ok(route, { state: state.guest ? 'GUEST' : 'AUTHENTICATED', user: state.guest ? null : { ...user(state.actor), role: state.role ?? 'USER', profilePhotoPublic: !!state.photoPublic }, sessionId: state.guest ? null : id(99 + state.actor), reason: null, serverTime: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), reauthenticatedUntil: new Date(Date.now() + 600000).toISOString() });
    if (path === '/auth/csrf') return ok(route, { token: 'fixture-review-csrf' });
    if (path === '/me' && method === 'PATCH') { state.photoPublic = req.postDataJSON().profilePhotoPublic; state.writes.push({ path, body: req.postDataJSON() }); return ok(route, { ...user(state.actor), role: state.role ?? 'USER', profilePhotoPublic: state.photoPublic }); }
    if (path === '/me') return ok(route, { ...user(state.actor), role: state.role ?? 'USER', profilePhotoPublic: !!state.photoPublic });
    if (path === '/me/sessions') return ok(route, [], { nextCursor: null });
    if (path === '/me/actions/status') return ok(route, { status: state.reviews.length ? 'COMMITTED' : 'NOT_FOUND', completedAt: new Date().toISOString() });
    if (path === '/me/notifications/summary') return ok(route, { unreadCount: 0, recent: [] });
    if (path.startsWith('/profiles/') && !path.endsWith('/reviews') && !path.endsWith('/listings')) {
      if (state.failProfile || state.unavailable) return error(route, state.unavailable ? 404 : 503);
      return ok(route, { ...person(2), displayName: state.name, city, joinedAt: '2026-09-01T00:00:00Z', rating: { average: state.reviews.length ? 5 : null, count: state.reviews.length } });
    }
    if (path.endsWith('/listings') && path.startsWith('/profiles/')) return ok(route, state.listings, { nextCursor: null });
    if (path.endsWith('/reviews') && path.startsWith('/profiles/')) return ok(route, state.reviews, { nextCursor: null });
    if (path === `/transactions/${id(10)}/handover`) return ok(route, { transactionId: id(10), version: 5, deadlineAt: new Date().toISOString(), serverTime: new Date().toISOString(), agreed: null, pending: null, directions: [], permissions: { canPropose: false, canRespond: false, canWithdraw: false, reason: 'Transaksi sudah selesai.' } });
    if (path === `/transactions/${id(10)}/timeline`) return ok(route, [], { nextCursor: null });
    if (path === '/transactions/' + id(10)) return ok(route, transaction());
    if (path === `/transactions/${id(10)}/reviews`) {
      if (method === 'GET') return ok(route, { transactionVersion: 5, eligibility: { canReview: state.actor === 3 && !state.expired && !state.reviews.length, reason: state.reviews.length ? 'Ulasan sudah dikirim.' : state.expired ? 'Batas waktu 30 hari untuk mengulas telah berakhir.' : state.actor === 2 ? 'Hanya pembeli atau penerima barang yang dapat mengulas transaksi ini.' : null, deadlineAt: new Date(Date.now() + 86400000).toISOString(), target: state.actor === 3 ? person(2) : null }, reviews: state.reviews });
      const body = req.postDataJSON(); state.writes.push({ path, body, key: req.headers()['idempotency-key'] }); state.reviews = [{ ...review(), rating: body.rating, comment: body.comment || null }]; return state.commitThenFail ? error(route) : ok(route, state.reviews[0]);
    }
    if (path === `/reviews/${id(20)}/reply`) { const body = req.postDataJSON(); state.writes.push({ path, body }); state.reviews = state.reviews.map(r => ({ ...r, version: 2, reply: { id: id(21), body: body.body, version: 1, visibility: 'VISIBLE', createdAt: new Date().toISOString() } })); return ok(route, state.reviews[0]); }
    if (path === `/admin/reports/${id(30)}/metadata`) return ok(route, { id: id(30), targetType: 'REVIEW', targetId: id(20), reasonCode: 'OTHER', status: 'IN_REVIEW', assignedAdminId: id(state.actor), version: 2, createdAt: new Date().toISOString() });
    if (path === `/admin/reports/${id(30)}/access`) return ok(route, { id: id(31), expiresAt: new Date(Date.now() + 300000).toISOString() });
    if (path === `/admin/reports/${id(30)}`) return ok(route, { id: id(30), targetType: 'REVIEW', targetId: id(20), reasonCode: 'OTHER', status: 'IN_REVIEW', version: 2, createdAt: new Date().toISOString(), details: 'Konten ulasan perlu ditinjau admin.', listing: null, message: null, reviewContent: { id: id(20), rating: 5, comment: review().comment, visibility: state.hidden ? 'HIDDEN' : 'VISIBLE', version: state.hidden ? 2 : 1, purgedAt: null } });
    if (path === `/admin/reviews/${id(20)}/visibility`) { state.writes.push({ path, body: req.postDataJSON() }); state.hidden = req.postDataJSON().visibility === 'HIDDEN'; return ok(route, { id: id(20), version: 2, visibility: state.hidden ? 'HIDDEN' : 'VISIBLE' }); }
    if (path === '/reports') { state.reports.push(req.postDataJSON()); return ok(route, { id: id(30), status: 'OPEN', createdAt: new Date().toISOString() }); }
    if (path === '/categories') return ok(route, []);
    if (path === '/cities') return ok(route, [city]);
    if (path.startsWith('/market/')) return ok(route, listing(40));
    return ok(route, []);
  });
  return state;
}
async function fits(page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
async function capture(page, name, project) { const dir = resolve('.impeccable/review/profiles'); await mkdir(dir, { recursive: true }); await page.screenshot({ path: resolve(dir, `${name}-${project}.png`), fullPage: ['profile', 'reviews', 'narrow'].includes(name) }); }

test('guest reads public profile and empty reviews with URL tabs', async ({ page }) => {
  await mock(page, { guest: true }); await page.goto(`/profil/${id(2)}`); await expect(page.getByRole('heading', { name: 'Pemilik Valora' })).toBeVisible();
  await expect(page.getByText('Belum ada barang aktif.')).toBeVisible(); await page.getByRole('link', { name: /^Ulasan/ }).click(); await expect(page).toHaveURL(/tab=ulasan/); await expect(page.getByRole('heading', { name: 'Belum ada ulasan.' })).toBeVisible(); await page.reload(); await expect(page.getByRole('link', { name: /^Ulasan/ })).toHaveAttribute('aria-current', 'page'); await fits(page);
});
test('public listings preserve four desktop and two mobile columns', async ({ page }, info) => {
  await mock(page, { guest: true, listings: Array.from({ length: 8 }, (_, i) => listing(100 + i)) }); await page.goto(`/profil/${id(2)}`); await expect(page.getByText('Barang pilihan 100')).toBeVisible();
  const columns = await page.locator('.catalog-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length); expect(columns).toBe(info.project.name === 'mobile' ? 2 : 4); const avatar = await page.locator('.public-profile-avatar').evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor })); expect(avatar.color).not.toBe(avatar.background); await fits(page); await capture(page, 'profile', info.project.name);
});
test('review text is plain text and public authors have profile links', async ({ page }, info) => {
  await mock(page, { guest: true, reviews: [{ ...review(), comment: '<b>Informasi barang sesuai.</b>', reply: { id: id(21), body: 'Terima kasih sudah menggunakan kembali barangnya.', createdAt: new Date().toISOString(), visibility: 'VISIBLE', version: 1 } }] }); await page.goto(`/profil/${id(2)}?tab=ulasan`);
  await expect(page.getByText('<b>Informasi barang sesuai.</b>', { exact: true })).toBeVisible(); await expect(page.locator('.review-comment b')).toHaveCount(0); await expect(page.getByRole('link', { name: 'Pengguna Valora', exact: true })).toHaveAttribute('href', `/profil/${id(3)}`); await expect(page.getByRole('button', { name: 'Laporkan ulasan' })).toHaveCount(0); await fits(page); await capture(page, 'reviews', info.project.name);
});
test('profile error retry and unavailable account', async ({ page }) => {
  const state = await mock(page, { guest: true, failProfile: true }); await page.goto(`/profil/${id(2)}`); await expect(page.getByRole('heading', { name: 'Profil belum dapat dimuat.' })).toBeVisible(); state.failProfile = false; await page.getByRole('button', { name: 'Coba lagi' }).click(); await expect(page.getByRole('heading', { name: state.name })).toBeVisible(); state.unavailable = true; await page.reload(); await expect(page.getByRole('heading', { name: 'Profil tidak tersedia.' })).toBeVisible();
});
test('rating is required and optional comment can be empty', async ({ page }, info) => {
  const state = await mock(page); await page.goto(`/app/transaksi/${id(10)}`); const send = page.getByRole('button', { name: 'Kirim ulasan', exact: true }); await expect(send).toBeDisabled();
  await page.getByRole('radio', { name: '4 bintang' }).check(); await expect(send).toBeEnabled(); await page.locator('.transaction-reviews').scrollIntoViewIfNeeded(); await capture(page, 'form', info.project.name); await send.click(); await expect(page.getByText('Ulasan sudah dikirim.')).toBeVisible(); expect(state.writes.at(-1).body).toEqual({ expectedTransactionVersion: 5, rating: 4 }); expect(state.writes.at(-1).key).toBeTruthy(); await expect(send).toHaveCount(0);
});
test('native radio keyboard works and comments are bounded', async ({ page }) => {
  await mock(page); await page.goto(`/app/transaksi/${id(10)}`); const radio = page.getByRole('radio', { name: '2 bintang' }); await radio.focus(); await radio.press('ArrowRight'); await expect(page.getByRole('radio', { name: '3 bintang' })).toBeChecked(); await expect(page.getByLabel('Komentar (opsional)')).toHaveAttribute('maxlength', '1000'); await fits(page);
});
test('expired eligibility provides explanation and no form', async ({ page }) => {
  await mock(page, { expired: true }); await page.goto(`/app/transaksi/${id(10)}`); await expect(page.getByText('Batas waktu 30 hari untuk mengulas telah berakhir.')).toBeVisible(); await expect(page.getByRole('button', { name: 'Kirim ulasan' })).toHaveCount(0);
});
test('lost response recovers status without sending a second review', async ({ page }) => {
  const state = await mock(page, { commitThenFail: true }); await page.goto(`/app/transaksi/${id(10)}`); await page.getByRole('radio', { name: '5 bintang' }).check(); await page.getByRole('button', { name: 'Kirim ulasan' }).click(); await page.getByRole('button', { name: 'Periksa ulang tindakan' }).click(); await expect(page.getByText('Ulasan sudah dikirim.')).toBeVisible(); expect(state.writes.filter(w => w.path.endsWith('/reviews'))).toHaveLength(1);
});
test('recipient sends one final reply', async ({ page }, info) => {
  const state = await mock(page, { actor: 2, reviews: [review()] }); await page.goto(`/app/transaksi/${id(10)}`); await page.getByRole('button', { name: 'Balas ulasan' }).click(); await page.getByLabel('Balasanmu').fill('Terima kasih sudah memberi barang ini cerita berikutnya.'); await page.locator('.transaction-reviews').scrollIntoViewIfNeeded(); await capture(page, 'reply', info.project.name); await page.getByRole('button', { name: 'Kirim balasan' }).click(); await expect(page.getByText('Terima kasih sudah memberi barang ini cerita berikutnya.')).toBeVisible(); await expect(page.getByRole('button', { name: 'Balas ulasan' })).toHaveCount(0); expect(state.writes.at(-1).body.expectedReviewVersion).toBe(1);
});
test('report modal is centered and supports focus and private reason', async ({ page }, info) => {
  const state = await mock(page, { actor: 2, reviews: [review()] }); await page.goto(`/profil/${id(2)}?tab=ulasan`); await page.getByRole('button', { name: 'Laporkan ulasan' }).click(); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); const rect = await dialog.boundingBox(), viewport = page.viewportSize(); expect(Math.abs(rect.x + rect.width / 2 - viewport.width / 2)).toBeLessThan(3); expect(Math.abs(rect.y + rect.height / 2 - viewport.height / 2)).toBeLessThan(3); await dialog.getByLabel('Penjelasan').fill('Ada informasi pribadi yang perlu ditinjau.'); await dialog.getByRole('button', { name: 'Kirim laporan' }).click(); await expect(dialog.getByText('Laporan terkirim untuk ditinjau admin.')).toBeVisible(); expect(state.reports[0].targetType).toBe('REVIEW'); await capture(page, 'report', info.project.name); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});
test('public photo opt-in is explicit and server confirmed', async ({ page }) => {
  const state = await mock(page, { actor: 2 }); await page.goto('/app/profil'); const control = page.getByLabel('Tampilkan foto profil ke publik', { exact: false }); await expect(control).not.toBeChecked(); await control.click(); await expect(control).toBeChecked(); await expect(page.getByText('Pengaturan foto publik tersimpan.')).toBeVisible(); expect(state.photoPublic).toBe(true); await control.click(); await expect(control).not.toBeChecked(); expect(state.photoPublic).toBe(false);
});
test('long names and review content fit 320px', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 }); await mock(page, { guest: true, name: 'Nama profil panjang '.repeat(8), reviews: [{ ...review(), comment: 'KontenTanpaSpasi'.repeat(60) }] }); await page.goto(`/profil/${id(2)}?tab=ulasan`); await expect(page.locator('.review-comment')).toBeVisible(); await fits(page); await capture(page, 'narrow', info.project.name);
});

test('assigned admin moderates review using scoped access', async ({ page }, info) => {
  const state = await mock(page, { actor: 4, role: 'ADMIN' }); await page.goto(`/app/admin/laporan/${id(30)}`);
  await page.getByLabel('Alasan tindakan').fill('Meninjau konten berdasarkan laporan pengguna.');
  await page.getByRole('button', { name: 'Buka isi laporan', exact: true }).click();
  let dialog = page.getByRole('dialog'); await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Simpan tindakan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ulasan yang dilaporkan' })).toBeVisible(); await fits(page); await capture(page, 'admin', info.project.name);
  await page.getByRole('button', { name: 'Sembunyikan konten' }).click(); dialog = page.getByRole('dialog'); await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Simpan tindakan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pulihkan konten' })).toBeVisible(); expect(state.writes.at(-1).body.reportId).toBe(id(30));
});
