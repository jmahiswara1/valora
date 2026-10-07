import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const city = { id: id(1), code: '3571', name: 'Kota Kediri', provinceName: 'Jawa Timur' };
const user = { id: id(2), email: 'searches@demo.valora.local', displayName: 'Pengguna Pencarian', role: 'USER', status: 'ACTIVE', city, emailVerifiedAt: null, version: 1 };
const row = (n, filters = { q: 'meja kerja', category: 'furniture', cityId: city.id }) => ({ id: id(n), name: n === 10 ? 'Meja untuk ruang kerja' : `Pencarian ${n}`, filters, sort: 'newest', alertsEnabled: true, version: 1, createdAt: '2026-10-06T09:00:00Z' });
async function mock(page, { guest = false, rows = [] } = {}) {
  const state = { guest, userId: user.id, rows, requests: [], failList: false, failCreate: false, commitThenFail: false, csrfDelay: 0, notifications: [] };
  const ok = (route, data, meta) => route.fulfill({ json: { data, ...(meta ? { meta } : {}) } });
  const error = (route, code, message, status = 503) => route.fulfill({ status, json: { error: { code, message } } });
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.slice('/api/v1'.length), method = req.method();
    state.requests.push({ path, method, search: url.search, body: method === 'POST' || method === 'PATCH' ? req.postDataJSON() : null });
    if (path === '/auth/session') return ok(route, { state: state.guest ? 'GUEST' : 'AUTHENTICATED', sessionId: state.guest ? null : state.userId, user: state.guest ? null : { ...user, id: state.userId }, reason: null, serverTime: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), reauthenticatedUntil: null });
    if (path === '/auth/csrf') { if (state.csrfDelay) await new Promise(done => setTimeout(done, state.csrfDelay)); return ok(route, { token: 'search-fixture-token' }); }
    if (path === '/auth/login') { state.guest = false; return ok(route, { ...user, id: state.userId }); }
    if (path === '/auth/logout') { state.guest = true; return ok(route, null); }
    if (path === '/me') return ok(route, { ...user, id: state.userId });
    if (path === '/categories') return ok(route, [{ code: 'furniture', name: 'Furnitur', subcategories: [] }, { code: 'electronics', name: 'Elektronik', subcategories: [] }]);
    if (path === '/cities') return ok(route, [city]);
    if (path === '/market') return ok(route, [], { nextCursor: null });
    if (path.startsWith('/market/')) return error(route, 'NOT_FOUND', 'Listing tidak ditemukan.', 404);
    if (path === '/me/notifications/summary') return ok(route, { unreadCount: state.notifications.filter(row => !row.readAt).length, recent: state.notifications });
    if (path === '/me/notifications') return ok(route, state.notifications, { nextCursor: null });
    if (path.startsWith('/me/notifications/') && method === 'POST') { state.notifications = state.notifications.map(row => ({ ...row, readAt: new Date().toISOString() })); return ok(route, { read: true, readAt: new Date().toISOString() }); }
    if (path === '/me/saved-searches') {
      if (method === 'GET') return state.failList ? error(route, 'DEPENDENCY_UNAVAILABLE', 'Daftar gagal dimuat.') : ok(route, state.rows);
      const body = req.postDataJSON();
      if (state.failCreate) return error(route, 'DEPENDENCY_UNAVAILABLE', 'Pencarian gagal disimpan. Coba lagi.');
      const existing = state.rows.find(row => JSON.stringify(row.filters) === JSON.stringify(body.filters));
      if (existing) return ok(route, existing);
      if (state.rows.length >= 10) return error(route, 'SAVED_SEARCH_LIMIT', 'Maksimum 10 pencarian tersimpan.', 409);
      const saved = { ...row(100 + state.rows.length, body.filters), name: body.name, sort: body.sort, alertsEnabled: body.alertsEnabled };
      state.rows = [saved, ...state.rows];
      if (state.commitThenFail) return error(route, 'DEPENDENCY_UNAVAILABLE', 'Respons terputus. Periksa status lalu coba lagi.');
      return ok(route, saved);
    }
    if (path.startsWith('/me/saved-searches/')) {
      const rowId = path.split('/').at(-1), current = state.rows.find(row => row.id === rowId);
      if (method === 'DELETE') { state.rows = state.rows.filter(row => row.id !== rowId); return ok(route, { removed: true }); }
      const body = req.postDataJSON();
      if (!current || current.version !== body.expectedVersion) return error(route, 'STATE_CONFLICT', 'Pencarian telah berubah. Muat ulang sebelum melanjutkan.', 409);
      const updated = { ...current, ...body, version: current.version + 1 }; state.rows = state.rows.map(row => row.id === rowId ? updated : row); return ok(route, updated);
    }
    return ok(route, []);
  });
  return state;
}
const saveButton = page => page.getByRole('button', { name: 'Simpan pencarian', exact: true });
const dialog = page => page.getByRole('dialog');
async function save(page, name = 'Meja pilihan') {
  await saveButton(page).click(); await dialog(page).getByLabel('Nama pencarian').fill(name); await dialog(page).getByRole('button', { name: 'Simpan pencarian', exact: true }).click(); await expect(dialog(page)).toHaveCount(0);
}
async function fits(page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }

test('guest returns from login with filters intact and saves explicitly', async ({ page }) => {
  const state = await mock(page, { guest: true }); await page.goto('/market?q=meja+kerja&type=RESELL&minPriceIdr=50000');
  await saveButton(page).click(); await expect(page).toHaveURL(/\/masuk\?next=/); expect(state.requests.some(row => row.path === '/me/saved-searches')).toBe(false);
  await page.getByLabel('Email', { exact: true }).fill(user.email); await page.getByLabel('Kata sandi', { exact: true }).fill('Fixture-only-2026!'); await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).toHaveURL(/\/market\?q=meja\+kerja&type=RESELL&minPriceIdr=50000/); await expect(page.locator('#market-q')).toHaveValue('meja kerja');
  expect(state.rows).toHaveLength(0); await save(page); expect(state.rows).toHaveLength(1);
});
test('applied URL restores all controls and excludes unsubmitted drafts', async ({ page }) => {
  const state = await mock(page); await page.goto(`/market?q=meja&category=furniture&type=RESELL&cityId=${city.id}&condition=GOOD&minPriceIdr=50000&maxPriceIdr=250000&sort=price_asc`);
  await page.getByRole('button', { name: /^Filter/ }).click(); await expect(page.locator('#market-city')).toHaveValue('Kota Kediri, Jawa Timur');
  await expect(page.locator('#market-min')).toHaveValue('50000'); await expect(page.locator('#market-max')).toHaveValue('250000'); await page.locator('#market-q').fill('draft yang belum diterapkan');
  await saveButton(page).click(); await dialog(page).getByLabel('Beritahu saya').uncheck(); await dialog(page).getByRole('button', { name: 'Simpan pencarian', exact: true }).click();
  await expect(dialog(page)).toHaveCount(0); expect(state.rows[0].filters.q).toBe('meja'); expect(state.rows[0].sort).toBe('price_asc'); expect(state.rows[0].alertsEnabled).toBe(false); expect(state.rows[0].filters.minPriceIdr).toBe(50000);
});
test('refresh and back forward restore applied keyword', async ({ page }) => {
  await mock(page); await page.goto('/market?q=satu'); await page.locator('#market-q').fill('dua'); await page.getByRole('button', { name: /^Cari/ }).click();
  await expect(page).toHaveURL(/q=dua/); await page.goBack(); await expect(page.locator('#market-q')).toHaveValue('satu'); await page.goForward(); await expect(page.locator('#market-q')).toHaveValue('dua'); await page.reload(); await expect(page.locator('#market-q')).toHaveValue('dua');
});
test('sort alone cannot be saved and invalid URL can be reset', async ({ page }) => {
  const state = await mock(page); await page.goto('/market?sort=score_desc'); await expect(saveButton(page)).toBeDisabled(); await expect(page.getByText('Belum ada barang yang cocok.')).toBeVisible();
  await page.goto('/market?type=DONATE&minPriceIdr=200'); await expect(page.getByText('Parameter pencarian tidak valid.')).toBeVisible(); await expect(saveButton(page)).toBeDisabled();
  expect(state.requests.filter(row => row.path === '/market').at(-1)?.search).toContain('score_desc'); await page.getByRole('button', { name: 'Reset filter', exact: true }).click(); await expect(page).toHaveURL(/\/market$/);
});
test('zero results can be saved and dialog is centered accessible and responsive', async ({ page }, testInfo) => {
  await mock(page); await page.goto('/market?q=kursi+kerja&category=furniture'); await expect(page.getByText('Belum ada barang yang cocok.')).toBeVisible();
  await saveButton(page).click(); await expect(dialog(page)).toBeVisible(); const bounds = await dialog(page).boundingBox(), viewport = page.viewportSize();
  expect(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2)).toBeLessThan(2); expect(Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2)).toBeLessThan(2);
  await expect(dialog(page).getByRole('button', { name: 'Tutup dialog' })).toBeFocused(); await page.keyboard.press('Shift+Tab'); await expect(dialog(page).getByRole('button', { name: 'Kembali' })).toBeFocused(); await page.keyboard.press('Tab'); await expect(dialog(page).getByRole('button', { name: 'Tutup dialog' })).toBeFocused();
  await fits(page); const dir = resolve('.impeccable/review/searches'); await mkdir(dir, { recursive: true }); await page.screenshot({ path: resolve(dir, `save-${testInfo.project.name}.png`) });
  await page.keyboard.press('Escape'); await expect(dialog(page)).toHaveCount(0); await expect(saveButton(page)).toBeFocused();
});
test('manage rename toggle remove and open saved results', async ({ page }, testInfo) => {
  const state = await mock(page, { rows: [row(10), row(11, { type: 'DONATE', category: 'electronics' }), { ...row(12, { q: 'Barang rumah tangga untuk ruang bersama', type: 'RESELL', minPriceIdr: 100000, maxPriceIdr: 350000 }), alertsEnabled: false, name: 'Perlengkapan rumah yang ingin dipakai kembali' }] });
  await page.goto('/app/pencarian'); await expect(page.getByRole('heading', { name: 'Pencarian tersimpan', exact: true })).toBeVisible(); await expect(page.locator('.saved-search-list > li')).toHaveCount(3); await fits(page);
  if (page.viewportSize().width > 760) expect((await page.locator('.saved-search-row-actions a').first().boundingBox()).width).toBeGreaterThan(100);
  await expect(page.locator('.saved-search-row-actions button svg').first()).toHaveCSS('width', '18px');
  const dir = resolve('.impeccable/review/searches'); await mkdir(dir, { recursive: true }); await page.screenshot({ path: resolve(dir, `${testInfo.project.name}.png`), fullPage: true });
  await page.getByRole('button', { name: 'Ubah nama Meja untuk ruang kerja' }).click(); await dialog(page).getByLabel('Nama pencarian').fill('Ruang kerja baru'); await dialog(page).getByRole('button', { name: 'Simpan nama' }).click(); await expect(page.getByRole('heading', { name: 'Ruang kerja baru' })).toBeVisible();
  await page.getByRole('button', { name: 'Nonaktifkan notifikasi Ruang kerja baru' }).click(); await expect(page.getByRole('button', { name: 'Aktifkan notifikasi Ruang kerja baru' })).toBeVisible();
  await page.getByRole('button', { name: 'Hapus Pencarian 11' }).click(); await expect(dialog(page).getByRole('button', { name: 'Hapus pencarian', exact: true })).toHaveClass(/button-danger/); await page.screenshot({ path: resolve(dir, `delete-${testInfo.project.name}.png`) }); await dialog(page).getByRole('button', { name: 'Hapus pencarian', exact: true }).click(); await expect(page.locator('.saved-search-list > li')).toHaveCount(2);
  expect(state.rows).toHaveLength(2); await page.locator('.saved-search-list > li').first().getByRole('link', { name: 'Lihat hasil' }).click(); await expect(page.locator('#market-q')).toHaveValue('meja kerja'); await expect(page).toHaveURL(/cityId=/);
});
test('create error and lost response reconcile without duplicate or optimistic success', async ({ page }) => {
  const state = await mock(page); state.failCreate = true; await page.goto('/market?q=meja'); await saveButton(page).click(); await dialog(page).getByRole('button', { name: 'Simpan pencarian', exact: true }).click();
  await expect(dialog(page).getByText('Pencarian gagal disimpan. Coba lagi.')).toBeVisible(); expect(state.rows).toHaveLength(0);
  state.failCreate = false; state.commitThenFail = true; await dialog(page).getByRole('button', { name: 'Simpan pencarian', exact: true }).click(); await expect(dialog(page).getByText('Respons terputus. Periksa status lalu coba lagi.')).toBeVisible();
  expect(state.rows).toHaveLength(1); state.commitThenFail = false; await dialog(page).getByRole('button', { name: 'Simpan pencarian', exact: true }).click(); await expect(dialog(page)).toHaveCount(0); expect(state.rows).toHaveLength(1); await expect(page.getByRole('button', { name: 'Pencarian tersimpan' })).toBeVisible();
});
test('duplicate criteria opens manager and quota is explained', async ({ page }) => {
  const state = await mock(page, { rows: Array.from({ length: 10 }, (_, index) => row(10 + index, { q: index ? `quota ${index}` : 'meja' })) });
  await page.goto('/market?q=MEJA'); await page.getByRole('button', { name: 'Pencarian tersimpan' }).click(); await expect(page).toHaveURL(/\/app\/pencarian/);
  await page.goto('/market?q=baru'); await saveButton(page).click(); await dialog(page).getByRole('button', { name: 'Simpan pencarian', exact: true }).click(); await expect(dialog(page).getByText('Maksimum 10 pencarian tersimpan.')).toBeVisible(); expect(state.rows).toHaveLength(10);
});
test('private list retries and empty state remains useful', async ({ page }) => {
  const state = await mock(page); state.failList = true; await page.goto('/app/pencarian'); await expect(page.getByText('Pencarian gagal dimuat.')).toBeVisible(); state.failList = false; await page.getByRole('button', { name: 'Coba lagi', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Belum ada pencarian tersimpan.' })).toBeVisible();
});
test('account switch closes private dialog and cancels old csrf-bound save', async ({ page }) => {
  const state = await mock(page); state.csrfDelay = 500; await page.goto('/market?q=rahasia'); await saveButton(page).click(); await dialog(page).getByRole('button', { name: 'Simpan pencarian', exact: true }).click();
  state.userId = id(99); state.rows = []; await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'valora-session-change', newValue: String(Date.now()) })));
  await expect(dialog(page)).toHaveCount(0); await page.waitForTimeout(800); expect(state.requests.filter(row => row.path === '/me/saved-searches' && row.method === 'POST')).toHaveLength(0); await expect(page.getByText('rahasia tersimpan.', { exact: false })).toHaveCount(0);
});
test('market notification opens listing and marks read', async ({ page }) => {
  const state = await mock(page); state.notifications = [{ id: id(800), type: 'SAVED_SEARCH_MATCH', category: 'market', title: 'Barang baru yang cocok', message: 'Ada barang baru sesuai pencarian tersimpanmu.', itemTitle: 'Kursi kerja', target: { kind: 'LISTING', id: id(900) }, createdAt: '2026-10-06T09:00:00Z', readAt: null }];
  await page.goto('/app/notifikasi'); await page.getByRole('button', { name: 'Market', exact: true }).click(); await page.getByRole('link', { name: /Barang baru yang cocok/ }).click(); await expect(page).toHaveURL(new RegExp('/market/' + id(900))); await expect.poll(() => state.notifications[0].readAt).not.toBeNull(); await expect(page.getByRole('heading', { name: /Barang|Listing/i }).first()).toBeVisible();
});
test('320px long criteria and names stay inside viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mock(page, { rows: [{ ...row(10, { q: 'x'.repeat(100), type: 'RESELL', minPriceIdr: 100000, maxPriceIdr: 900000 }), name: 'Nama panjang '.repeat(6).slice(0,80) }] });
  await page.goto('/app/pencarian'); await expect(page.locator('.saved-search-list > li')).toHaveCount(1); await fits(page); await page.getByRole('button', { name: /^Ubah nama/ }).click(); await fits(page);
  await expect(dialog(page).getByLabel('Nama pencarian')).toHaveCSS('font-size', '16px');
});
