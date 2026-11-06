import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const id = n => '20000000-0000-4000-8000-' + String(n).padStart(12, '0');
const date = '2026-11-01T08:00:00Z';
const user = { id: id(1), email: 'item@example.test', displayName: 'Dara', role: 'USER', status: 'ACTIVE', emailVerifiedAt: date,
  city: { id: id(2), name: 'Kota Kediri', code: '3571', provinceName: 'Jawa Timur' }, createdAt: date, version: 1, profilePhotoUrl: null };
const item = { id: id(10), title: 'Keyboard mekanik pribadi', description: 'Keyboard untuk bekerja dan belajar sehari-hari. Dirawat dan dibersihkan secara berkala.', categoryCode: 'electronics', subcategoryCode: null,
  functionSummary: 'Semua tombol berfungsi dengan baik.', conditionSummary: 'Bekas pakai ringan, tanpa kerusakan pada bodi.', completenessSummary: 'Keyboard, kabel USB, dan kotak penyimpanan.', issueSummary: null,
  purchaseYear: 2024, originalPriceIdr: 450000, estimatedWeightGrams: 800, reservedByTransactionId: null, version: 1, itemRevision: 1, createdAt: date, updatedAt: date,
  media: [1, 2].map(n => ({ id: id(20 + n), mime: 'image/webp', bytes: 1200, width: 800, height: 600, orderIndex: n - 1 })) };
const assessment = { id: id(30), itemId: item.id, score: 83, status: 'COMPLETE', label: 'Potensi sirkular tinggi', createdAt: date, isCurrent: true, origin: 'USER_REPORTED' };
async function mock(page, options = {}) {
  const state = { item: structuredClone(item), assessments: [{ ...assessment }], failItem: false, failAssessment: false, failPhoto: false, failDelete: false, delayAssessment: 0, writes: [], requests: [], ...options };
  const ok = (route, data) => route.fulfill({ json: { data } });
  const fail = (route, status = 503) => route.fulfill({ status, json: { error: { code: status === 409 ? 'STATE_CONFLICT' : 'DEPENDENCY_UNAVAILABLE', message: status === 409 ? 'Foto belum dapat dihapus. Coba lagi.' : 'Data belum tersedia.' } } });
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.slice('/api/v1'.length);
    state.requests.push(path);
    if (path === '/auth/session') return ok(route, { state: 'AUTHENTICATED', reason: null, user, sessionId: user.id, serverTime: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), reauthenticatedUntil: null });
    if (path === '/auth/csrf') return ok(route, { token: 'item-detail-csrf' });
    if (path === '/me/notifications/summary') return ok(route, { unreadCount: 0, recent: [] });
    if (path === `/items/${item.id}`) return state.failItem ? fail(route) : ok(route, state.item);
    if (path === `/items/${item.id}/assessments`) {
      if (state.delayAssessment) await new Promise(done => setTimeout(done, state.delayAssessment));
      return state.failAssessment ? fail(route) : ok(route, state.assessments);
    }
    if (/^\/media\/[^/]+\/access$/.test(path)) return state.failPhoto ? fail(route) : ok(route, { url: `/images/keyboard.webp?photo=${path.split('/')[2]}` });
    if (request.method() === 'DELETE') {
      state.writes.push({ path, csrf: request.headers()['x-csrf-token'] });
      if (state.failDelete) return fail(route, 409);
      state.item = { ...state.item, version: state.item.version + 1, itemRevision: state.item.itemRevision + 1, media: state.item.media.filter(photo => photo.id !== path.split('/').at(-1)) };
      state.assessments = state.assessments.map(row => ({ ...row, isCurrent: false }));
      return ok(route, state.item);
    }
    if (path === `/items/${item.id}/passport`) return ok(route, { itemId: item.id, projection: 'OWNER', title: item.title, description: item.description, categoryCode: 'electronics', visibility: 'PUBLIC', version: 1,
      media: [], timeline: [], share: { url: `https://valora.example/passport/${item.id}`, access: 'UNAVAILABLE' } });
    return ok(route, []);
  });
  return state;
}
const open = page => page.goto(`/app/barang/${item.id}`);
async function confirmRemoval(page) {
  const dialog = page.getByRole('dialog', { name: 'Hapus foto barang' });
  await expect(dialog.getByRole('button', { name: 'Hapus foto', exact: true })).toBeDisabled();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Hapus foto', exact: true }).click();
}

test('overview separates photos, score, information and shortcuts across viewports', async ({ page }, info) => {
  await mock(page); await mkdir(resolve('../../.local/item-detail'), { recursive: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await open(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.title);
    await expect(page.locator('.item-assessment-value strong')).toHaveText('83');
    await expect(page.getByRole('heading', { name: 'Tentang barang', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kondisi dan kelengkapan', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Informasi tambahan', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit barang', exact: true })).toHaveCount(1);
    const gallery = await page.locator('.item-detail-gallery').boundingBox(), score = await page.locator('.item-assessment-summary').boundingBox();
    if (width === 1440) expect(score.x).toBeGreaterThan(gallery.x + gallery.width);
    else expect(score.y).toBeGreaterThan(gallery.y + gallery.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.account-gallery-main img')).toHaveCSS('object-fit', 'contain');
    for (const control of await page.locator('.item-detail-page a, .item-detail-page button').all()) {
      if (await control.isVisible()) expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    if (width === 390 || width === 1440) await page.screenshot({ path: resolve(`../../.local/item-detail/overview-${info.project.name}-${width}.png`), fullPage: true });
  }
});

test('score states distinguish zero, incomplete, partial, historical and absent assessments', async ({ page }) => {
  const state = await mock(page);
  const cases = [
    { rows: [{ ...assessment, score: 0, label: 'Perlu perhatian' }], heading: null, value: '0', action: 'Lihat hasil' },
    { rows: [{ ...assessment, score: null, status: 'INCOMPLETE' }], heading: 'Penilaian belum lengkap', action: 'Lihat hasil' },
    { rows: [{ ...assessment, score: null, status: 'PARTIAL_ECONOMIC' }], heading: 'Nilai ekonomi belum lengkap', action: 'Lihat hasil' },
    { rows: [{ ...assessment, isCurrent: false }], heading: 'Penilaian perlu diperbarui', action: 'Buat penilaian baru' },
    { rows: [], heading: 'Barang ini belum dinilai', action: 'Mulai penilaian' },
  ];
  for (const scenario of cases) {
    state.assessments = scenario.rows; await open(page);
    const summary = page.getByRole('region', { name: 'Valora Score', exact: true });
    await expect(summary.getByRole('link', { name: scenario.action, exact: true })).toBeVisible();
    if (scenario.heading) { await expect(summary.getByRole('heading', { name: scenario.heading, exact: true })).toBeVisible(); await expect(summary.locator('.item-assessment-value')).toHaveCount(0); }
    else await expect(summary.locator('.item-assessment-value strong')).toHaveText(scenario.value);
  }
});

test('reserved items keep read access and block edits, photo deletion and new assessment', async ({ page }) => {
  await mock(page, { item: { ...structuredClone(item), reservedByTransactionId: id(99) }, assessments: [] }); await open(page);
  await expect(page.getByRole('link', { name: 'Edit barang', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Hapus foto 1/ })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Mulai penilaian', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Buka transaksi/ })).toHaveAttribute('href', `/app/transaksi/${id(99)}`);
  await expect(page.getByRole('link', { name: 'Riwayat penilaian', exact: true })).toHaveAttribute('href', `/app/barang/${item.id}/penilaian`);
});

test('photo selection, consent and deletion retain focus and refresh assessment status', async ({ page }) => {
  const state = await mock(page); await open(page);
  await expect(page.getByRole('button', { name: /Hapus foto/ })).toHaveCount(1);
  const second = page.getByRole('button', { name: `Lihat foto 2 ${item.title}` }); await second.focus(); await page.keyboard.press('Enter');
  await expect(second).toHaveAttribute('aria-pressed', 'true'); await expect(page.getByText('Foto 2 dari 2', { exact: true })).toBeVisible();
  await expect(page.locator('.account-gallery-main img')).toHaveAttribute('src', new RegExp(id(22)));
  await page.getByRole('button', { name: `Hapus foto 2 ${item.title}` }).click();
  await expect(page.getByRole('dialog', { name: 'Hapus foto barang' })).toBeVisible();
  expect(state.writes).toHaveLength(0); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: `Hapus foto 2 ${item.title}` })).toBeFocused();
  await page.getByRole('button', { name: `Hapus foto 2 ${item.title}` }).click(); await confirmRemoval(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.writes).toEqual([{ path: `/items/${item.id}/media/${id(22)}`, csrf: 'item-detail-csrf' }]);
  await expect(page.getByRole('button', { name: `Lihat foto 1 ${item.title}` })).toBeFocused();
  await expect(page.getByText('Foto 1 dari 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Penilaian perlu diperbarui', exact: true })).toBeVisible();
});

test('deleting the last photo restores focus to the empty gallery', async ({ page }) => {
  await mock(page, { item: { ...structuredClone(item), media: [item.media[0]] } }); await open(page);
  await page.getByRole('button', { name: `Hapus foto 1 ${item.title}` }).click(); await confirmRemoval(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.item-detail-gallery')).toBeFocused();
  await expect(page.getByText('Belum ada foto', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Hapus foto/ })).toHaveCount(0);
});

test('failed deletion preserves selected photo and permits a confirmed retry', async ({ page }) => {
  const state = await mock(page, { failDelete: true }); await open(page);
  await page.getByRole('button', { name: `Hapus foto 1 ${item.title}` }).click(); await confirmRemoval(page);
  await expect(page.getByRole('dialog')).toContainText('Foto belum dapat dihapus. Coba lagi.');
  expect(state.item.media).toHaveLength(2);
  state.failDelete = false; await page.getByRole('dialog').getByRole('button', { name: 'Hapus foto', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(state.writes).toHaveLength(2);
  await expect(page.getByText('Foto 1 dari 1', { exact: true })).toBeVisible();
});

test('assessment loading and failure do not hide item details and can be retried', async ({ page }) => {
  const state = await mock(page, { delayAssessment: 1500, failAssessment: true, failPhoto: true }); await open(page);
  await expect(page.getByRole('status', { name: 'Memuat penilaian', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.title);
  const summary = page.getByRole('region', { name: 'Valora Score', exact: true });
  await expect(summary).toContainText('Status penilaian gagal dimuat.');
  await expect(page.getByRole('img', { name: `Foto belum tersedia: Foto ${item.title}`, exact: true })).toBeVisible();
  state.failAssessment = false; state.delayAssessment = 0;
  await summary.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(summary.locator('.item-assessment-value strong')).toHaveText('83');
});

test('item failure has retry and a route back to the private inventory', async ({ page }) => {
  const state = await mock(page, { failItem: true }); await open(page);
  await expect(page.getByText('Barang tidak ditemukan atau gagal dimuat.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kembali ke daftar', exact: true })).toHaveAttribute('href', '/app/barang');
  state.failItem = false; await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.title);
});

test('shortcuts keep existing routes and QR uses the owner Passport projection', async ({ page }) => {
  const state = await mock(page); await open(page);
  for (const [name, path] of [['Passport barang', 'passport'], ['Perawatan & perbaikan', 'perbaikan'], ['Lihat panduan', 'panduan']]) {
    await expect(page.getByRole('link', { name, exact: true })).toHaveAttribute('href', `/app/barang/${item.id}/${path}`);
  }
  await expect(page.getByRole('link', { name: 'Lihat hasil', exact: true })).toHaveAttribute('href', `/app/barang/${item.id}/penilaian/${assessment.id}`);
  const trigger = page.getByRole('button', { name: 'QR Passport', exact: true }); await trigger.click();
  await expect(page.getByRole('dialog').getByLabel('Tautan Passport publik')).toHaveValue(`https://valora.example/passport/${item.id}`);
  expect(state.requests).toContain(`/items/${item.id}/passport`);
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
});

test('long content, zero price and absent optional data remain readable', async ({ page }) => {
  const long = 'Keyboard dengan nama panjang untuk ruang belajar dan bekerja bersama '.repeat(2).slice(0, 120);
  const state = await mock(page, { item: { ...structuredClone(item), title: long, description: 'Catatan barang yang tetap terbaca lengkap. '.repeat(65), functionSummary: 'Kondisi tombol dan fungsi tambahan. '.repeat(35), completenessSummary: null, purchaseYear: null, originalPriceIdr: 0, estimatedWeightGrams: null } });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await open(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(long);
    await expect(page.locator('.item-detail-description > p')).toHaveText(state.item.description);
    await expect(page.locator('.item-detail-facts-grid')).toContainText('Rp');
    await expect(page.locator('.item-detail-facts-grid')).not.toContainText('NaN');
    await expect(page.locator('.item-detail-facts-grid')).toContainText('Belum diisi');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
