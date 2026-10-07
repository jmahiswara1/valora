import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

const id = number => '00000000-0000-4000-8000-' + String(number).padStart(12, '0');
const itemId = id(10);
const canonicalUrl = `http://localhost:3000/passport/${itemId}`;
const city = { id: id(1), code: '3571', name: 'Kota Kediri', provinceName: 'Jawa Timur' };
const user = { id: id(2), email: 'qr@demo.valora.local', displayName: 'Pemilik Passport', role: 'USER', status: 'ACTIVE', city,
  emailVerifiedAt: '2026-10-06T00:00:00Z', createdAt: '2026-10-06T00:00:00Z', version: 1 };

async function mock(page, { guest = false, access = 'PUBLIC', local = true, hidden = false } = {}) {
  const state = { guest, access, userId: user.id, ownerId: user.id, failPassport: false, delay: 0, requests: [] };
  const ok = (route, data) => route.fulfill({ json: { data } });
  const error = (route, status) => route.fulfill({ status, json: { error: { code: status === 404 ? 'NOT_FOUND' : 'DEPENDENCY_UNAVAILABLE', message: 'Passport tidak ditemukan.' } } });
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.slice('/api/v1'.length);
    state.requests.push(path);
    if (path === '/auth/session') return ok(route, { state: state.guest ? 'GUEST' : 'AUTHENTICATED', reason: null, serverTime: new Date().toISOString(),
      user: state.guest ? null : { ...user, id: state.userId }, sessionId: state.guest ? null : state.userId, expiresAt: new Date(Date.now() + 86400000).toISOString(), reauthenticatedUntil: null });
    if (path === '/me/notifications/summary') return ok(route, { unreadCount: 0, recent: [] });
    if (path === '/auth/csrf') return ok(route, { token: 'qr-fixture-csrf' });
    if (path === `/items/${itemId}`) return state.userId === state.ownerId ? ok(route, { id: itemId, title: 'Keyboard mekanik pribadi', description: 'Catatan privat pemilik saat ini.', categoryCode: 'electronics', subcategoryCode: null,
      functionSummary: 'Berfungsi', conditionSummary: 'Baik', completenessSummary: null, issueSummary: null, purchaseYear: null,
      originalPriceIdr: null, estimatedWeightGrams: null, reservedByTransactionId: null, version: 1, itemRevision: 1, media: [], createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z' }) : error(route, 404);
    if (path === `/items/${itemId}/assessments`) return ok(route, []);
    if (path.endsWith('/passport') || path === `/passport/${itemId}`) {
      const owner = path.startsWith('/items/');
      if (state.delay) await new Promise(done => setTimeout(done, state.delay));
      if (state.failPassport) return error(route, 503);
      if ((owner && (state.guest || state.userId !== state.ownerId)) || (!owner && state.access === 'UNAVAILABLE')) return error(route, 404);
      return ok(route, { itemId, categoryCode: 'electronics', visibility: hidden ? 'HIDDEN' : state.access === 'LIMITED' ? 'LIMITED' : 'PUBLIC', version: 1,
        projection: owner ? 'OWNER' : 'PUBLIC', title: owner ? 'Keyboard mekanik pribadi' : state.access === 'LIMITED' ? null : 'Keyboard mekanik publik',
        description: owner ? 'SECRET OWNER DESCRIPTION' : state.access === 'LIMITED' ? null : 'Barang yang telah dipublikasikan.', media: [],
        timeline: state.access === 'LIMITED' && !owner ? [] : [{ id: id(11), type: 'REGISTERED', origin: 'SYSTEM_CONFIRMED', occurredAt: '2026-10-06T00:00:00Z', recordedAt: '2026-10-06T00:00:00Z', correctionOfId: null, summary: 'Didaftarkan di Valora' }],
        share: { url: local ? canonicalUrl : `https://valora.example/passport/${itemId}`, access: state.access } });
    }
    return ok(route, []);
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copiedPassportUrl = text; } } });
  });
  return state;
}

async function openQr(page) {
  const trigger = page.getByRole('button', { name: 'QR Passport', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'QR untuk membuka Passport publik barang' })).toBeVisible();
  return dialog;
}

async function fits(page, dialog) {
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2)).toBeLessThan(2);
  expect(bounds.width).toBeLessThanOrEqual(viewport.width - 30);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  for (const control of await dialog.locator('button, a').all()) {
    if (await control.isVisible()) expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
}

test('owner detail creates a canonical QR, copies and downloads a decodable 1024 PNG', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const state = await mock(page);
  await page.goto(`/app/barang/${itemId}`);
  await expect(page.getByRole('button', { name: 'QR Passport', exact: true })).toBeVisible();
  expect(state.requests.filter(path => path.endsWith('/passport'))).toHaveLength(0);
  const dialog = await openQr(page);
  await expect(dialog.getByText('Tautan ini masih memakai alamat lokal', { exact: false })).toBeVisible();
  await fits(page, dialog);
  const directory = resolve('../../.local/passport-qr'); await mkdir(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, `owner-qr-${info.project.name}.png`) });
  await dialog.getByRole('button', { name: 'Salin tautan', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Tautan Passport disalin.');
  expect(await page.evaluate(() => window.__copiedPassportUrl)).toBe(canonicalUrl);
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('link', { name: 'Unduh PNG', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`valora-passport-${itemId}.png`);
  const image = PNG.sync.read(await readFile(await download.path()));
  expect([image.width, image.height]).toEqual([1024, 1024]);
  expect([...image.data.subarray(0, 4)]).toEqual([255, 255, 255, 255]);
  expect(jsQR(new Uint8ClampedArray(image.data), image.width, image.height)?.data).toBe(canonicalUrl);
  await expect(dialog.getByRole('link', { name: 'Buka Passport publik', exact: false })).toHaveAttribute('href', canonicalUrl);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'QR Passport', exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test('owner can save a draft QR, and reopening fetches fresh public availability', async ({ page }) => {
  const state = await mock(page, { access: 'UNAVAILABLE' });
  await page.goto(`/app/barang/${itemId}/passport`);
  let dialog = await openQr(page);
  await expect(dialog.locator('.passport-qr-access')).toContainText('Passport publik belum tersedia.');
  await expect(dialog.getByRole('link', { name: 'Unduh PNG', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Tutup QR Passport' }).click();
  const previous = state.requests.filter(path => path.endsWith('/passport')).length;
  state.access = 'PUBLIC'; state.delay = 150;
  dialog = await openQr(page);
  await expect(dialog.locator('.passport-qr-access')).toContainText('tanpa login');
  expect(state.requests.filter(path => path.endsWith('/passport')).length).toBeGreaterThan(previous);
});

test('guest can share a public Passport without reading an owner endpoint', async ({ page }) => {
  const state = await mock(page, { guest: true, local: false });
  await page.goto(`/passport/${itemId}`);
  const dialog = await openQr(page);
  await expect(dialog.getByLabel('Tautan Passport publik')).toHaveValue(`https://valora.example/passport/${itemId}`);
  await expect(dialog.locator('.passport-qr-local')).toHaveCount(0);
  expect(state.requests.some(path => path.startsWith('/items/'))).toBe(false);
  await expect(page.locator('body')).not.toContainText('SECRET OWNER DESCRIPTION');
});

test('LIMITED public QR only exposes the restriction status', async ({ page }) => {
  await mock(page, { guest: true, access: 'LIMITED' });
  await page.goto(`/passport/${itemId}`);
  await expect(page.locator('.passport-timeline')).toHaveCount(0);
  const dialog = await openQr(page);
  await expect(dialog.locator('.passport-qr-access')).toContainText('halaman status tanpa riwayat barang');
});

test('unavailable public Passport has a neutral state without QR or private data', async ({ page }) => {
  await mock(page, { guest: true, access: 'UNAVAILABLE' });
  await page.goto(`/passport/${itemId}`);
  await expect(page.getByRole('heading', { name: 'Passport belum tersedia.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'QR Passport', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Jelajahi Market' })).toHaveAttribute('href', '/market');
  await expect(page.locator('body')).not.toContainText('Keyboard mekanik pribadi');
});

test('owner of a hidden Passport sees the restriction and can retain the same QR', async ({ page }) => {
  await mock(page, { access: 'UNAVAILABLE', hidden: true });
  await page.goto(`/app/barang/${itemId}/passport`);
  const dialog = await openQr(page);
  await expect(dialog.locator('.passport-qr-access')).toContainText('sedang disembunyikan');
  await expect(dialog.getByLabel('Tautan Passport publik')).toHaveValue(canonicalUrl);
  await expect(dialog.getByRole('link', { name: 'Unduh PNG', exact: true })).toBeVisible();
});

test('failed clipboard selects a readable link for manual copying', async ({ page }) => {
  await mock(page, { guest: true });
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } }); });
  await page.goto(`/passport/${itemId}`);
  const dialog = await openQr(page);
  await dialog.getByRole('button', { name: 'Salin tautan', exact: true }).click();
  const input = dialog.getByLabel('Tautan Passport publik');
  await expect(input).toBeFocused();
  expect(await input.evaluate(node => node.selectionEnd - node.selectionStart)).toBe(canonicalUrl.length);
  await expect(dialog.getByRole('status')).toContainText('secara manual');
});

test('QR generation failure allows link copying and retries successfully', async ({ page }) => {
  await mock(page, { guest: true });
  await page.addInitScript(() => {
    window.__failQr = true;
    const original = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...args) { if (window.__failQr) throw new Error('Canvas failed'); return original.apply(this, args); };
  });
  await page.goto(`/passport/${itemId}`);
  await page.getByRole('button', { name: 'QR Passport', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('QR belum berhasil dibuat.');
  await expect(dialog.getByRole('button', { name: 'Unduh PNG', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Salin tautan', exact: true }).click();
  expect(await page.evaluate(() => window.__copiedPassportUrl)).toBe(canonicalUrl);
  await page.evaluate(() => { window.__failQr = false; });
  await dialog.getByRole('button', { name: 'Buat QR lagi' }).click();
  await expect(dialog.getByRole('img', { name: 'QR untuk membuka Passport publik barang' })).toBeVisible();
  await expect(dialog.getByLabel('Tautan Passport publik')).toBeFocused();
});

test('failed refresh hides cached QR and retries the Passport request', async ({ page }) => {
  const state = await mock(page);
  await page.goto(`/app/barang/${itemId}/passport`);
  await expect(page.getByRole('button', { name: 'QR Passport', exact: true })).toBeVisible();
  state.failPassport = true;
  await page.getByRole('button', { name: 'QR Passport', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('Passport belum dapat diakses.');
  await expect(dialog.getByRole('img')).toHaveCount(0);
  state.failPassport = false;
  await dialog.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(dialog.getByRole('img', { name: 'QR untuk membuka Passport publik barang' })).toBeVisible();
  expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
});

test('modal traps keyboard focus and remains centered at narrow widths', async ({ page }) => {
  await mock(page, { guest: true });
  await page.goto(`/passport/${itemId}`);
  const dialog = await openQr(page);
  for (const width of [320, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await fits(page, dialog);
  }
  for (let step = 0; step < 10; step++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
});

test('account switch clears a private QR dialog and old ownership data', async ({ page }) => {
  const state = await mock(page);
  await page.goto(`/app/barang/${itemId}/passport`);
  await openQr(page);
  state.userId = id(99);
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'valora-session-change', newValue: 'fixture' })));
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('body')).not.toContainText('SECRET OWNER DESCRIPTION');
  await expect(page.getByRole('button', { name: 'QR Passport', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('logout closes an open QR and restores page scrolling', async ({ page }) => {
  const state = await mock(page);
  await page.goto(`/app/barang/${itemId}/passport`);
  await openQr(page);
  state.guest = true;
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'valora-session-change', newValue: 'logout' })));
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page).toHaveURL(/\/masuk\?next=/);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});
