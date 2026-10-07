import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const user = { id: id(1), email: 'notifications@demo.valora.local', displayName: 'Pengguna Notifikasi', role: 'USER', status: 'ACTIVE',
  city: { id: id(2), code: '3571', name: 'Kota Kediri', provinceName: 'Jawa Timur' }, emailVerifiedAt: null, createdAt: '2026-10-05T00:00:00Z', version: 1 };
const seed = count => Array.from({ length: count }, (_, i) => ({ id: id(i + 10), type: i % 2 ? 'HANDOVER_REMINDER' : 'OFFER_RECEIVED', category: i % 2 ? 'transactions' : 'offers',
  title: i % 2 ? 'Pengingat serah terima' : 'Penawaran baru', message: i % 2 ? 'Periksa serah terima dan konfirmasi.' : 'Ada penawaran yang menunggu tanggapanmu.',
  itemTitle: `Barang ${i + 1}`, target: { kind: i % 2 ? 'TRANSACTION' : 'OFFER', id: id(100 + i) }, createdAt: new Date(Date.UTC(2026, 9, 5, 12, 0, -i)).toISOString(), readAt: null }));
async function mock(page, count = 6, guest = false) {
  const state = { rows: seed(count), guest, userId: user.id, requests: [], failSummary: false, failList: false, failMore: false, failMutation: false, commitThenFail: false, delay: 0, csrfDelay: 0 };
  const ok = (route, data, meta) => route.fulfill({ json: { data, ...(meta ? { meta } : {}) } });
  const fail = route => route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Koneksi notifikasi terputus.' } } });
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.slice('/api/v1'.length), method = request.method();
    state.requests.push({ path, method, search: url.search, csrf: request.headers()['x-csrf-token'] });
    if (path === '/auth/session') return ok(route, { state: state.guest ? 'GUEST' : 'AUTHENTICATED', reason: null, serverTime: new Date().toISOString(), sessionId: state.guest ? null : state.userId, user: state.guest ? null : { ...user, id: state.userId }, expiresAt: new Date(Date.now() + 86400000).toISOString(), reauthenticatedUntil: null });
    if (path === '/auth/csrf') { if (state.csrfDelay) await new Promise(done => setTimeout(done, state.csrfDelay)); return ok(route, { token: 'notification-fixture-csrf' }); }
    if (path === '/auth/logout') { state.guest = true; return ok(route, null); }
    if (path === '/me/notifications/summary') return state.failSummary ? fail(route) : ok(route, { unreadCount: state.rows.filter(row => !row.readAt).length, recent: state.rows.slice(0, 5) });
    if (path === '/me/notifications') {
      const offset = Number(url.searchParams.get('cursor') ?? 0), limit = Number(url.searchParams.get('limit') ?? 20);
      if (state.failList || (offset && state.failMore)) return fail(route);
      const category = url.searchParams.get('category') ?? 'all', status = url.searchParams.get('status') ?? 'all';
      const rows = state.rows.filter(row => (category === 'all' || row.category === category) && (status !== 'unread' || !row.readAt));
      return ok(route, rows.slice(offset, offset + limit), { nextCursor: rows.length > offset + limit ? String(offset + limit) : null });
    }
    if (path.startsWith('/me/notifications/') && method === 'POST') {
      if (state.delay) await new Promise(done => setTimeout(done, state.delay));
      if (state.failMutation) return fail(route);
      const all = path.endsWith('/read-all'), rowId = path.split('/')[3], readAt = new Date().toISOString();
      let count = 0;
      state.rows = state.rows.map(row => { if ((all || row.id === rowId) && !row.readAt) { count++; return { ...row, readAt }; } return row; });
      if (state.commitThenFail) return fail(route);
      return ok(route, { read: true, readAt, count });
    }
    if (path.startsWith('/offers/') && path !== '/offers/mine') return ok(route, { id: path.split('/').at(-1), listingId: id(300), listingRevisionId: id(301), bidderId: id(99), exchangeItemId: null, status: 'REJECTED', exchangeSnapshot: null, transactionId: null, endReason: 'REJECTED', expiresAt: '2026-10-12T00:00:00Z', version: 2, currentRevision: null, createdAt: '2026-10-05T00:00:00Z', listing: { title: 'Barang 1', type: 'RESELL' } });
    if (path === '/items' || path === '/market') return ok(route, [], { nextCursor: null });
    if (path === '/categories') return ok(route, []);
    return ok(route, []);
  });
  return state;
}
const bell = page => page.locator('.notification-bell > button');

test('guest has no bell and makes no private notification requests', async ({ page }) => {
  const state = await mock(page, 6, true); await page.goto('/market');
  await expect(page.locator('.header-favorite-link')).toBeVisible(); await expect(bell(page)).toHaveCount(0);
  expect(state.requests.some(row => row.path.startsWith('/me/notifications'))).toBe(false);
  await page.goto('/app/notifikasi'); await expect(page).toHaveURL(/\/masuk\?next=%2Fapp%2Fnotifikasi/);
  expect(state.requests.some(row => row.path.startsWith('/me/notifications'))).toBe(false);
});

test('preview is five recent notifications, does not read, and supports keyboard dismissal', async ({ page }) => {
  const state = await mock(page); await page.goto('/market');
  await expect(bell(page)).toHaveAttribute('aria-label', 'Notifikasi, 6 belum dibaca');
  await bell(page).click(); const preview = page.getByRole('region', { name: 'Preview notifikasi' });
  await expect(preview).toBeVisible(); await expect(preview).toBeFocused(); await expect(preview.locator('li')).toHaveCount(5);
  expect(state.requests.some(row => row.method === 'POST')).toBe(false);
  await page.keyboard.press('Escape'); await expect(preview).toHaveCount(0); await expect(bell(page)).toBeFocused();
  await bell(page).click(); await page.mouse.click(2, 2); await expect(preview).toHaveCount(0);
});

test('opening a notification reads it and navigates to its real offer detail', async ({ page }) => {
  const state = await mock(page); await page.goto('/market'); await bell(page).click();
  await page.locator('.notification-preview-list .notification-entry-link').first().click();
  await expect(page).toHaveURL(new RegExp('/app/penawaran/' + id(100))); await expect(page.getByRole('heading', { name: 'Detail penawaran' })).toBeVisible();
  await expect(bell(page)).toHaveAttribute('aria-label', 'Notifikasi, 5 belum dibaca');
  expect(state.requests.find(row => row.method === 'POST').csrf).toBe('notification-fixture-csrf');
  await page.goto('/app/notifikasi'); await expect(page.locator('.notification-list li')).toHaveCount(6);
  await expect(page.locator('.notification-list li').first()).not.toHaveClass(/is-unread/);
  await page.reload(); await expect(bell(page)).toHaveAttribute('aria-label', 'Notifikasi, 5 belum dibaca');
});

test('filters, single read focus, and read all stay synchronized', async ({ page }) => {
  await mock(page); await page.goto('/app/notifikasi');
  await expect(page.locator('.notification-list li')).toHaveCount(6);
  await page.getByRole('button', { name: 'Penawaran', exact: true }).click(); await expect(page.locator('.notification-list li')).toHaveCount(3);
  await page.getByRole('button', { name: 'Semua aktivitas', exact: true }).click();
  await page.getByRole('button', { name: /Belum dibaca/ }).click();
  await page.locator('.notification-list .notification-read-button').first().click();
  await expect(page.locator('.notification-list li')).toHaveCount(5); await expect(page.locator('.notification-list .notification-entry-link').first()).toBeFocused();
  await page.getByRole('button', { name: 'Tandai semua dibaca' }).click();
  await expect(page.getByRole('heading', { name: 'Semua kabar sudah kamu baca.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Notifikasi', exact: true })).toBeFocused(); await expect(bell(page)).toHaveAttribute('aria-label', 'Notifikasi');
  await page.getByRole('button', { name: 'Semua', exact: true }).click(); await expect(page.locator('.notification-list li')).toHaveCount(6);
  await expect(page.locator('.notification-list .is-unread')).toHaveCount(0);
});

test('failed read retains unread state and permits a single pending retry', async ({ page }) => {
  const state = await mock(page); await page.goto('/app/notifikasi'); state.failMutation = true;
  await page.locator('.notification-read-button').first().click();
  await expect(page.locator('.notification-feedback')).toContainText('belum dapat'); await expect(bell(page)).toHaveAttribute('aria-label', 'Notifikasi, 6 belum dibaca');
  await expect(page.locator('.notification-list li').first()).toHaveClass(/is-unread/);
  state.failMutation = false; state.delay = 250; await page.locator('.notification-read-button').first().click();
  await expect(page.locator('.notification-read-button').first()).toBeDisabled();
  await expect(bell(page)).toHaveAttribute('aria-label', 'Notifikasi, 5 belum dibaca');
  expect(state.requests.filter(row => row.method === 'POST')).toHaveLength(2);
  await expect(page.locator('.notification-feedback')).toHaveCount(0);
});

test('lost read response reconciles state and preserves feedback after navigation', async ({ page }) => {
  const state = await mock(page); state.commitThenFail = true;
  await page.goto('/app/notifikasi'); await page.locator('.notification-entry-link').first().click();
  await expect(page).toHaveURL(/\/app\/penawaran\//); await expect(page.locator('.notification-feedback')).toBeVisible();
  await expect(bell(page)).toHaveAttribute('aria-label', 'Notifikasi, 5 belum dibaca');
  expect(state.requests.filter(row => row.method === 'POST')).toHaveLength(1);
});

test('summary and list errors have retries without reporting a false zero', async ({ page }) => {
  const state = await mock(page); state.failSummary = true; state.failList = true;
  await page.goto('/app/notifikasi'); await expect(bell(page)).toHaveAttribute('aria-label', 'Notifikasi, jumlah belum tersedia');
  await expect(page.locator('.notification-badge')).toHaveCount(0);
  await bell(page).click(); await expect(page.locator('.notification-popover')).toContainText('gagal dimuat');
  state.failSummary = false; await page.locator('.notification-popover').getByRole('button', { name: 'Coba lagi' }).click();
  await expect(bell(page)).toHaveAttribute('aria-label', 'Notifikasi, 6 belum dibaca'); await page.keyboard.press('Escape');
  state.failList = false; await page.locator('.notifications-page').getByRole('button', { name: 'Coba lagi' }).click();
  await expect(page.locator('.notification-list li')).toHaveCount(6);
});

test('pagination failure retains rows and all read covers pages not loaded', async ({ page }) => {
  const state = await mock(page, 25); state.failMore = true; await page.goto('/app/notifikasi');
  await expect(page.locator('.notification-list li')).toHaveCount(20); await page.getByRole('button', { name: 'Muat lebih banyak' }).click();
  await expect(page.locator('.notification-pagination')).toContainText('gagal dimuat'); await expect(page.locator('.notification-list li')).toHaveCount(20);
  state.failMore = false; await page.locator('.notification-pagination').getByRole('button', { name: 'Coba lagi' }).click();
  await expect(page.locator('.notification-list li')).toHaveCount(25);
  await page.goto('/app/notifikasi'); await page.getByRole('button', { name: 'Tandai semua dibaca' }).click(); await expect(bell(page)).toHaveAttribute('aria-label', 'Notifikasi');
  expect(state.rows.every(row => row.readAt)).toBe(true);
});

test('account change and logout clear the notification cache', async ({ page }) => {
  const state = await mock(page); await page.goto('/market'); await expect(bell(page)).toHaveAttribute('aria-label', 'Notifikasi, 6 belum dibaca');
  state.userId = id(999); state.rows = [];
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'valora-session-change', newValue: 'fixture' })));
  await expect(bell(page)).toHaveAttribute('aria-label', 'Notifikasi'); await bell(page).click(); await expect(page.locator('.notification-popover')).toContainText('Belum ada notifikasi.');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Menu akun', exact: true }).click(); await page.locator('#header-account-menu').getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(bell(page)).toHaveCount(0);
});

test('navbar and preview fit target viewports with usable targets', async ({ page }, testInfo) => {
  await mock(page, 123); await mkdir(resolve('../../.local/notifications'), { recursive: true });
  for (const width of [320, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/app/notifikasi');
    await expect(page.locator('.notification-list li')).toHaveCount(20); await expect(page.locator('.notification-badge')).toHaveText('99+');
    const box = await bell(page).boundingBox(); expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 320 || width === 1440) await page.screenshot({ path: resolve(`../../.local/notifications/center-${testInfo.project.name}-${width}.png`), fullPage: true });
    await bell(page).click(); const panel = await page.locator('.notification-popover').boundingBox(); expect(panel.x).toBeGreaterThanOrEqual(0); expect(panel.x + panel.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
    if (width <= 600) { await expect(page.locator('.account-market-link')).toBeHidden(); await page.getByRole('button', { name: 'Buka navigasi akun' }).click(); await expect(page.locator('#account-drawer').getByRole('link', { name: 'Jelajahi Market' })).toBeVisible(); await page.keyboard.press('Escape'); }
    await page.goto('/market'); await expect(bell(page)).toBeVisible(); await bell(page).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 320 || width === 1440) await page.screenshot({ path: resolve(`../../.local/notifications/preview-${testInfo.project.name}-${width}.png`), fullPage: true });
  }
});

test('account switch while CSRF is pending cannot mark the next account read', async ({ page }) => {
  const state = await mock(page); state.csrfDelay = 600;
  await page.goto('/app/notifikasi'); await page.getByRole('button', { name: 'Tandai semua dibaca' }).click();
  await expect.poll(() => state.requests.some(row => row.path === '/auth/csrf')).toBe(true);
  state.userId = id(999); state.rows = seed(2);
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'valora-session-change', newValue: 'fixture' })));
  await expect(bell(page)).toHaveAttribute('aria-label', 'Notifikasi, 2 belum dibaca');
  await expect(page.locator('.notification-list li')).toHaveCount(2);
  await page.waitForTimeout(800);
  expect(state.requests.filter(row => row.method === 'POST')).toHaveLength(0);
  await expect(page.locator('.notification-feedback')).toHaveCount(0);
});

test('empty unread category does not claim other categories were read', async ({ page }) => {
  const state = await mock(page, 2); state.rows[0].readAt = new Date().toISOString();
  await page.goto('/app/notifikasi'); await page.getByRole('button', { name: /Belum dibaca/ }).click();
  await expect(page.locator('.notification-list li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Penawaran', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tidak ada kabar baru di kategori ini.' })).toBeVisible();
  await expect(bell(page)).toHaveAttribute('aria-label', 'Notifikasi, 1 belum dibaca');
});
