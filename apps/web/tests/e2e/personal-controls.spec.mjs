import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { mock as accountMock, id, items } from '../../.impeccable/review/app/fixtures.mjs';

async function mock(page) {
  const base = await accountMock(page);
  const requests = [];
  await page.route('**/api/v1/me/notifications**', route => {
    const url = new URL(route.request().url()); requests.push(url.pathname + url.search);
    return route.fulfill({ json: { data: url.pathname.endsWith('/summary') ? { unreadCount: 6, recent: [] } : [], meta: { nextCursor: null } } });
  });
  await page.route('**/api/v1/repair-tutorial-sessions/mine?*', route => {
    const url = new URL(route.request().url()); requests.push(url.pathname + url.search);
    const closed = url.searchParams.get('state') === 'closed';
    return route.fulfill({ json: { data: [{ id: id(800), itemId: items[0].id, itemTitle: items[0].title, title: closed ? 'Panduan selesai' : 'Merawat keyboard', activityKind: 'MAINTENANCE', state: closed ? 'RECORDED' : 'IN_PROGRESS', completedSteps: closed ? 3 : 1, totalSteps: 3, createdAt: '2026-11-01T10:00:00Z', recordId: null }], meta: { nextCursor: null } } });
  });
  return { ...base, requests };
}
const main = page => page.locator('.account-main');
async function buttonStyle(locator) {
  return locator.evaluate(el => { const s = getComputedStyle(el); return { minHeight: s.minHeight, radius: s.borderRadius, size: s.fontSize, weight: s.fontWeight, line: s.lineHeight, bg: s.backgroundColor, color: s.color, padding: s.padding, border: s.borderWidth }; });
}

test('Ruang saya routes share the same primary and secondary button language', async ({ page }) => {
  await mock(page); const primaries = [], secondaries = [];
  for (const path of ['/app', '/app/barang', '/app/barang/baru', '/app/notifikasi', '/app/panduan', '/app/impact', `/app/barang/${items[0].id}`, `/app/barang/${items[0].id}/edit`, `/app/barang/${items[0].id}/penilaian`, `/app/barang/${items[0].id}/perbaikan`, `/app/barang/${items[0].id}/passport`]) {
    await page.goto(path); await expect(main(page)).toHaveAttribute('data-workspace', 'personal');
    const primary = main(page).locator('.button-primary:visible').first(), secondary = main(page).locator('.button-secondary:visible').first();
    if (await primary.count()) primaries.push(await buttonStyle(primary));
    if (await secondary.count()) secondaries.push(await buttonStyle(secondary));
  }
  expect(primaries.length).toBeGreaterThanOrEqual(3); expect(secondaries.length).toBeGreaterThanOrEqual(2);
  for (const style of primaries) expect(style).toEqual(primaries[0]);
  for (const style of secondaries) expect(style).toEqual(secondaries[0]);
  expect(primaries[0]).toMatchObject({ minHeight: '44px', radius: '999px', size: '14px', weight: '600', bg: 'rgb(27, 58, 40)' });
});

test('notification and tutorial filters match and preserve keyboard filtering', async ({ page }) => {
  const state = await mock(page); await page.goto('/app/notifikasi');
  const unread = page.getByRole('button', { name: 'Belum dibaca 6', exact: true });
  await unread.focus(); await page.keyboard.press('Space'); await expect(unread).toHaveAttribute('aria-pressed', 'true');
  const notificationStyle = await buttonStyle(unread);
  await expect.poll(() => state.requests.some(path => path.includes('status=unread'))).toBe(true);
  await page.getByRole('button', { name: 'Penawaran', exact: true }).click();
  await expect.poll(() => state.requests.some(path => path.includes('category=offers'))).toBe(true);
  await page.goto('/app/panduan');
  const history = page.getByRole('button', { name: 'Riwayat', exact: true });
  await history.focus(); await page.keyboard.press('Enter'); await expect(history).toHaveAttribute('aria-pressed', 'true');
  expect(await buttonStyle(history)).toEqual(notificationStyle);
  await expect(page.getByRole('heading', { name: 'Panduan selesai' })).toBeVisible();
  await expect(history).toBeFocused();
  const focus = await history.evaluate(el => ({ width: getComputedStyle(el).outlineWidth, style: getComputedStyle(el).outlineStyle }));
  expect(focus).toEqual({ width: '2px', style: 'solid' });
});

test('forms and Impact picker share fields while preserving validation and selection', async ({ page }) => {
  const state = await mock(page); await page.goto('/app/barang/baru');
  const title = page.locator('#title'), category = page.getByRole('combobox', { name: 'Kategori', exact: true });
  await expect(category).toBeEnabled();
  const field = await category.evaluate(el => { const s = getComputedStyle(el); return { height: el.getBoundingClientRect().height, radius: s.borderRadius, fontSize: s.fontSize, border: s.borderColor }; });
  expect(field).toMatchObject({ height: 48, radius: '10px', fontSize: '16px' });
  await title.focus(); await expect(title).toBeFocused();
  expect(await title.evaluate(el => getComputedStyle(el).outlineWidth)).toBe('2px');
  await page.getByRole('button', { name: 'Simpan barang', exact: true }).click();
  expect(await title.evaluate(el => el.validity.valueMissing)).toBe(true);
  expect(state.writes.some(row => row.path === '/items')).toBe(false);
  await page.goto('/app/impact'); const period = page.getByRole('combobox', { name: /Periode laporan/ });
  expect(await period.evaluate(el => { const s = getComputedStyle(el); return { height: el.getBoundingClientRect().height, radius: s.borderRadius, fontSize: s.fontSize, border: s.borderColor }; })).toEqual(field);
  await period.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await expect(period).toContainText('Seluruh waktu'); await expect(period).toBeFocused();
});

test('disabled buttons and hover keep their shape and scope excludes other workspaces', async ({ page }) => {
  await mock(page); await page.goto(`/app/barang/${items[0].id}`);
  const remove = page.getByRole('button', { name: /Hapus foto 1/ }); await expect(remove).toBeVisible();
  const before = await buttonStyle(remove); await remove.hover(); const after = await buttonStyle(remove);
  expect(after.radius).toBe(before.radius); expect(after.padding).toBe(before.padding); expect(after.size).toBe('14px');
  await remove.click(); const confirm = page.getByRole('dialog').getByRole('button', { name: 'Hapus foto', exact: true });
  await expect(confirm).toBeDisabled(); expect((await buttonStyle(confirm)).minHeight).toBe('44px');
  await page.keyboard.press('Escape'); await expect(remove).toBeFocused();
  for (const path of ['/app/listings', '/app/penawaran', '/app/pesan', '/app/profil', '/market', '/']) {
    await page.goto(path); await expect(page.locator('[data-workspace="personal"]')).toHaveCount(0);
    if (!path.startsWith('/app')) await expect(page.locator('.header-account-trigger')).toBeVisible();
  }
});

test('personal controls fit all device widths and keep layouts independent', async ({ page }, info) => {
  await mock(page); await mkdir(resolve('../../.local/personal-controls'), { recursive: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [['overview', '/app'], ['notifications', '/app/notifikasi'], ['items', '/app/barang'], ['guides', '/app/panduan'], ['impact', '/app/impact'], ['form', '/app/barang/baru']]) {
      await page.goto(path); await expect(main(page)).toHaveAttribute('data-workspace', 'personal');
      expect(await main(page).locator('h1').first().evaluate(el => getComputedStyle(el).fontSize)).toBe(width <= 600 ? '26px' : '32px');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const button of await main(page).locator('.button:visible, .account-filters > button:visible').all()) {
        const box = await button.boundingBox(); expect(box.height).toBeGreaterThanOrEqual(44);
      }
      if ((width === 390 || width === 1440) && ['notifications', 'guides', 'form'].includes(name)) await page.screenshot({ path: resolve(`../../.local/personal-controls/${name}-${info.project.name}-${width}.png`), clip: { x: 0, y: 0, width, height: 700 } });
    }
  }
});
