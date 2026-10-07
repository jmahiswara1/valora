import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const city = { id: id(1), code: '3571', name: 'Kota Kediri', provinceName: 'Jawa Timur' };
const user = { id: id(2), email: 'favorites@demo.valora.local', displayName: 'Pengguna Favorit', role: 'USER', status: 'ACTIVE', city,
  emailVerifiedAt: '2026-10-04T00:00:00Z', createdAt: '2026-10-04T00:00:00Z', version: 1 };
function listing(n) {
  return { id: id(n), type: 'RESELL', status: 'ACTIVE', version: 1, owner: { displayName: 'Pemilik demo', city }, publishedAt: '2026-10-04T00:00:00Z',
    revision: { id: id(n + 100), itemId: id(n + 200), revisionNo: 1, assessmentId: id(n + 300), itemRevision: 1,
      title: `Barang Favorit ${n}`, description: 'Data simulasi UI Favorit.', categoryCode: 'electronics', categoryName: 'Elektronik', subcategoryCode: null,
      media: [{ id: id(n + 400), mime: 'image/webp', bytes: 100, orderIndex: 0, processedAt: '2026-10-04T00:00:00Z', url: '/images/keyboard.webp' }],
      city, condition: 83, score: 85, scoreLabel: null, ruleVersion: 'score-v1', conditionDisclosure: 'Bekas pemakaian ringan.',
      askingPriceIdr: 125000, exchangePreference: null, recipientNote: null, handoverMethods: ['MEETUP'], createdAt: '2026-10-04T00:00:00Z' } };
}
async function mock(page, { guest = false, count = 3, saved = false } = {}) {
  const state = { guest, userId: user.id, rows: Array.from({ length: count }, (_, i) => listing(i + 11)), favorites: new Map(),
    requests: [], failStatus: false, failMutation: false, commitThenFail: false, failMore: false, delay: 0 };
  if (saved) for (const row of state.rows) state.favorites.set(row.id, { listingId: row.id, savedAt: '2026-10-04T00:00:00Z', savedTitle: row.revision.title, availability: 'ACTIVE', listing: row });
  const ok = (route, data, meta) => route.fulfill({ json: { data, ...(meta ? { meta } : {}) } });
  const error = (route, status, message) => route.fulfill({ status, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message } } });
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.slice('/api/v1'.length), method = req.method();
    state.requests.push({ path, method, search: url.search, csrf: req.headers()['x-csrf-token'] });
    if (path === '/auth/session') return ok(route, { state: state.guest ? 'GUEST' : 'AUTHENTICATED', reason: null, serverTime: new Date().toISOString(),
      user: state.guest ? null : { ...user, id: state.userId }, sessionId: state.guest ? null : state.userId, expiresAt: new Date(Date.now() + 86400000).toISOString(), reauthenticatedUntil: null });
    if (path === '/me/notifications/summary') return ok(route, { unreadCount: 0, recent: [] });
    if (path === '/auth/csrf') return ok(route, { token: 'favorites-csrf-fixture' });
    if (path === '/auth/logout') { state.guest = true; return ok(route, null); }
    if (path === '/categories') return ok(route, [{ code: 'electronics', name: 'Elektronik', parentCode: null, active: true, sortOrder: 1 }]);
    if (path === '/market') return ok(route, state.rows, { nextCursor: null });
    if (/^\/market\/[a-f0-9-]+$/.test(path)) {
      const row = state.rows.find(row => row.id === path.split('/').at(-1));
      return row ? ok(route, row) : error(route, 404, 'Listing tidak ditemukan.');
    }
    if (path.startsWith('/passport/')) return ok(route, { itemId: path.split('/').at(-1), title: 'Barang demo', categoryCode: 'electronics', description: null, media: [], timeline: [], visibility: 'PUBLIC', projection: 'PUBLIC', version: 1, share: { url: 'http://localhost:3000' + path, access: 'PUBLIC' } });
    if (path === '/me/favorites/status') {
      if (state.failStatus) return error(route, 503, 'Status Favorit gagal.');
      return ok(route, url.searchParams.get('listingIds').split(',').map(listingId => ({ listingId, isFavorite: state.favorites.has(listingId) })));
    }
    if (path === '/me/favorites') {
      const offset = Number(url.searchParams.get('cursor') ?? 0);
      if (offset && state.failMore) return error(route, 503, 'Halaman berikutnya gagal.');
      const rows = [...state.favorites.values()]; const limit = Number(url.searchParams.get('limit') ?? 20);
      return ok(route, rows.slice(offset, offset + limit), { nextCursor: rows.length > offset + limit ? String(offset + limit) : null });
    }
    if (path.startsWith('/me/favorites/')) {
      if (state.delay) await new Promise(done => setTimeout(done, state.delay));
      const listingId = path.split('/').at(-1), desired = method === 'PUT';
      if (state.failMutation) return error(route, 503, 'Favorit belum dapat diperbarui.');
      if (desired) {
        const row = state.rows.find(row => row.id === listingId);
        state.favorites.set(listingId, { listingId, savedAt: new Date().toISOString(), savedTitle: row.revision.title, availability: 'ACTIVE', listing: row });
      } else state.favorites.delete(listingId);
      if (state.commitThenFail) return error(route, 503, 'Respons Favorit terputus.');
      return ok(route, { listingId, isFavorite: desired });
    }
    return ok(route, []);
  });
  return state;
}

test('guest opens login without a private Favorite request', async ({ page }) => {
  const state = await mock(page, { guest: true });
  await page.goto('/market');
  const heart = page.locator('.market-card .favorite-button').first();
  await expect(heart).toBeEnabled(); await heart.click();
  await expect(page).toHaveURL(/\/masuk\?next=%2Fmarket%2F/);
  expect(state.requests.some(row => row.path.startsWith('/me/favorites'))).toBe(false);
});

test('batch membership, independent heart, persistence and shared detail state', async ({ page }) => {
  const state = await mock(page, { count: 20 });
  await page.goto('/market');
  const heart = page.locator('.market-card .favorite-button').first();
  await expect(heart).toBeEnabled(); await expect(heart).toHaveAttribute('aria-pressed', 'false');
  expect(state.requests.filter(row => row.path === '/me/favorites/status')).toHaveLength(1);
  expect(new URLSearchParams(state.requests.find(row => row.path === '/me/favorites/status').search).get('listingIds').split(',')).toHaveLength(20);
  await expect(page.locator('.market-card a button')).toHaveCount(0);
  await heart.focus(); await page.keyboard.press('Space');
  await expect(heart).toHaveAttribute('aria-pressed', 'true'); await expect(page).toHaveURL(/\/market$/);
  expect(state.requests.find(row => row.method === 'PUT').csrf).toBe('favorites-csrf-fixture');
  await page.locator('.market-card-link').first().click();
  await expect(page).toHaveURL(new RegExp('/market/' + id(11)));
  const detail = page.locator('.detail-favorite .favorite-button');
  await expect(detail).toHaveAttribute('aria-pressed', 'true');
  await page.reload(); await expect(detail).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Favorit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Favorit', exact: true })).toBeVisible();
  await expect(page.locator('.favorites-catalog .market-card')).toHaveCount(1);
  await page.locator('.favorites-catalog .favorite-button').click();
  await expect(page.getByRole('heading', { name: 'Belum ada barang favorit.' })).toBeVisible();
  await expect(page.locator('.favorites-heading')).toBeFocused();
  await expect(page.locator('.favorites-result')).toContainText('dihapus');
});

test('mutation failure keeps the previous value and permits a retry', async ({ page }) => {
  const state = await mock(page);
  await page.goto('/market'); const heart = page.locator('.market-card .favorite-button').first(); await expect(heart).toBeEnabled();
  state.failMutation = true; await heart.click();
  await expect(page.locator('.favorite-feedback')).toContainText('belum dapat');
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  state.failMutation = false; state.delay = 150; await heart.click();
  await expect(heart).toBeDisabled(); await expect(heart).toHaveAttribute('aria-pressed', 'true');
  expect(state.requests.filter(row => row.method === 'PUT')).toHaveLength(2);
});

test('uncertain mutation response reconciles the server value', async ({ page }) => {
  const state = await mock(page);
  await page.goto('/market'); const heart = page.locator('.market-card .favorite-button').first(); await expect(heart).toBeEnabled();
  state.commitThenFail = true; await heart.click();
  await expect(page.locator('.favorite-feedback')).toContainText('terputus');
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  expect(state.requests.filter(row => row.method === 'PUT')).toHaveLength(1);
});

test('uncertain removal retains feedback and restores focus after reconciliation', async ({ page }) => {
  const state = await mock(page, { saved: true });
  await page.goto('/app/favorit'); await expect(page.locator('.favorites-catalog .market-card')).toHaveCount(3);
  state.commitThenFail = true; await page.locator('.favorites-catalog .favorite-button').first().click();
  await expect(page.locator('.favorites-catalog .market-card')).toHaveCount(2);
  await expect(page.locator('.favorites-page .notice-error')).toContainText('terputus');
  await expect(page.locator('.favorites-catalog .favorite-button').first()).toBeFocused();
});

test('unknown membership has a retry and does not claim unsaved', async ({ page }) => {
  const state = await mock(page); state.failStatus = true;
  await page.goto('/market'); const heart = page.locator('.market-card .favorite-button').first();
  await expect(page.locator('.favorite-status-error')).toBeVisible(); await expect(heart).toBeDisabled();
  await expect(heart).not.toHaveAttribute('aria-pressed', 'false');
  state.failStatus = false; await page.locator('.favorite-status-error button').click();
  await expect(heart).toBeEnabled(); await expect(heart).toHaveAttribute('aria-pressed', 'false');
});

test('ended favorites retain their names without photos and can be removed', async ({ page }) => {
  const state = await mock(page, { saved: true });
  const unavailable = state.favorites.get(id(11)); unavailable.availability = 'UNAVAILABLE'; unavailable.listing = null;
  const reserved = state.favorites.get(id(12)); reserved.availability = 'RESERVED'; reserved.listing = null;
  await page.goto('/app/favorit');
  await expect(page.locator('.favorite-unavailable')).toHaveCount(2);
  await expect(page.locator('.favorite-unavailable img')).toHaveCount(0);
  await expect(page.locator('.favorite-unavailable').first()).toContainText('Barang Favorit 11');
  await expect(page.locator('.favorite-unavailable').first()).toContainText('Tidak tersedia');
  await expect(page.locator('.favorite-unavailable').nth(1)).toContainText('Sedang dalam kesepakatan');
  await expect(page.locator('.favorite-unavailable .market-card-link')).toHaveCount(0);
  await page.locator('.favorite-unavailable .favorite-button').first().click();
  await expect(page.locator('.favorites-catalog .market-card')).toHaveCount(2);
  await expect(page.locator('.favorite-unavailable .favorite-button').first()).toBeFocused();
});

test('pagination retains existing cards after an error', async ({ page }) => {
  const state = await mock(page, { count: 22, saved: true }); state.failMore = true;
  await page.goto('/app/favorit'); await expect(page.locator('.favorites-catalog .market-card')).toHaveCount(20);
  await page.getByRole('button', { name: 'Muat lebih banyak' }).click();
  await expect(page.getByRole('button', { name: 'Coba muat lagi' })).toBeVisible();
  await expect(page.locator('.favorites-catalog .market-card')).toHaveCount(20);
  state.failMore = false; await page.getByRole('button', { name: 'Coba muat lagi' }).click();
  await expect(page.locator('.favorites-catalog .market-card')).toHaveCount(22);
});

test('logout and account switch clear the personal membership cache', async ({ page }) => {
  const state = await mock(page, { saved: true });
  await page.goto('/market'); const heart = page.locator('.market-card .favorite-button').first(); await expect(heart).toHaveAttribute('aria-pressed', 'true');
  state.userId = id(900); state.favorites.clear();
  await page.evaluate(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'valora-session-change', newValue: 'fixture' })); });
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Menu akun', exact: true }).click();
  await page.locator('#header-account-menu').getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(heart).toBeEnabled(); await expect(heart).not.toHaveAttribute('aria-pressed');
  await heart.click(); await expect(page).toHaveURL(/\/masuk/);
});

test('wishlist and navbar fit all target viewports', async ({ page }, testInfo) => {
  await mock(page, { count: 4, saved: true });
  await mkdir(resolve('../../.local/wishlist'), { recursive: true });
  for (const width of [320, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/app/favorit');
    await expect(page.locator('.favorites-catalog .market-card')).toHaveCount(4);
    await expect(page.locator('.account-toolbar a[aria-label="Favorit"]')).toBeVisible();
    const metrics = await page.locator('.favorites-catalog .catalog-grid').evaluate(el => ({ columns: getComputedStyle(el).gridTemplateColumns.split(' ').length,
      document: document.documentElement.scrollWidth, viewport: window.innerWidth,
      buttons: [...el.querySelectorAll('.favorite-button')].map(button => { const box = button.getBoundingClientRect(); return { width: box.width, height: box.height }; }) }));
    expect(metrics.columns).toBe(width >= 1024 ? 4 : 2); expect(metrics.document).toBeLessThanOrEqual(metrics.viewport);
    expect(metrics.buttons.every(button => button.width >= 44 && button.height >= 44)).toBe(true);
    if (width === 320 || width === 1440) await page.screenshot({ path: resolve(`../../.local/wishlist/favorites-${testInfo.project.name}-${width}.png`), fullPage: true });
    await page.goto('/market'); await expect(page.locator('.market-card .favorite-button').first()).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('.header-favorite-link')).toBeVisible();
    if (width <= 700) await expect(page.locator('.header-activity-link').first()).toBeHidden();
  }
});
