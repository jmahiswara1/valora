import { chooseOption } from '../helpers/select.mjs';
import { test, expect } from '@playwright/test';

const categories = [{ code: 'electronics', name: 'Elektronik', subcategories: [] }, { code: 'books', name: 'Buku', subcategories: [] }];
const city = { id: '00000000-0000-4000-8000-000000000001', code: '32.73', name: 'Kota Bandung', provinceName: 'Jawa Barat' };
const user = { id: '00000000-0000-4000-8000-000000000002', email: 'public-ui@example.test', displayName: 'Pengguna UI', city, role: 'USER', status: 'ACTIVE', emailVerifiedAt: '2026-10-03T00:00:00.000Z', profilePhotoProvider: null, profilePhotoUrl: null, profilePhotoMigrationAvailable: false };
const session = (authenticated = false) => ({ state: authenticated ? 'AUTHENTICATED' : 'GUEST', reason: null, serverTime: new Date().toISOString(), user: authenticated ? user : null, sessionId: authenticated ? '00000000-0000-4000-8000-000000000003' : null, expiresAt: authenticated ? new Date(Date.now() + 86400000).toISOString() : null, reauthenticatedUntil: null });
const notes = ['Repair dan estimasi berat dilaporkan pengguna.', 'Nilai Resell adalah harga final yang disepakati, bukan bukti pembayaran.'];

function listing(type, index, category = 'electronics', options = {}) {
  const id = '00000000-0000-4000-8000-' + String(index).padStart(12, '0');
  return {
    id, type, status: 'ACTIVE', version: 1, owner: { displayName: 'Pemilik demo', city }, publishedAt: '2026-10-03T00:00:00.000Z',
    revision: {
      id, itemId: id, revisionNo: 1, assessmentId: id, itemRevision: 1,
      title: options.title ?? 'Demo ' + (category === 'books' ? 'Buku' : 'Elektronik') + ' ' + index,
      description: 'Data simulasi untuk pengujian UI publik.', categoryCode: category, categoryName: category === 'books' ? 'Buku' : 'Elektronik', subcategoryCode: null,
      media: options.missing ? [] : [{ id, mime: 'image/png', bytes: 1, orderIndex: 0, processedAt: '2026-10-03T00:00:00.000Z', url: options.broken ? '/missing-public-ui-photo.png' : '/images/editorial/care-chair.png' }],
      city, condition: 83, score: type === 'RESELL' ? 85 : null, scoreLabel: null, ruleVersion: 'score-v1',
      conditionDisclosure: 'Data kondisi ini simulasi untuk pengujian tampilan dan interaksi.',
      askingPriceIdr: type === 'RESELL' ? 125000 : null, exchangePreference: null, recipientNote: null, handoverMethods: ['MEETUP'], createdAt: '2026-10-03T00:00:00.000Z',
    },
  };
}

async function mockPublic(page) {
  const state = { categoryError: false, marketError: false, empty: false, customListings: null, selectedCategory: 'electronics', requests: [] };
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { data: session() } }));
  await page.route(/\/api\/v1\/me\/favorites\/status(?:\?|$)/, route => {
    const ids = new URL(route.request().url()).searchParams.get('listingIds')?.split(',') ?? [];
    return route.fulfill({ json: { data: ids.map(listingId => ({ listingId, isFavorite: false })) } });
  });
  await page.route('**/api/v1/me/notifications/summary', route => route.fulfill({ json: { data: { unreadCount: 0, recent: [] } } }));
  await page.route('**/api/v1/categories', route => route.fulfill(state.categoryError ? { status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Kategori sementara tidak tersedia.' } } } : { json: { data: categories } }));
  await page.route(/\/api\/v1\/market(?:\?|$)/, route => {
    const url = new URL(route.request().url());
    state.requests.push(url);
    if (state.marketError) return route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Market sementara tidak tersedia.' } } });
    const category = url.searchParams.get('category') ?? 'electronics';
    state.selectedCategory = category;
    const data = state.empty ? [] : state.customListings ?? [listing('RESELL', 11, category), listing('DONATE', 12, category), listing('EXCHANGE', 13, category), { id: '00000000-0000-4000-8000-000000000014', type: 'RESELL', status: 'RESERVED' }];
    return route.fulfill({ json: { data } });
  });
  await page.route(/\/api\/v1\/market\/[a-f0-9-]+$/, route => route.fulfill({ json: { data: listing('RESELL', 11, state.selectedCategory) } }));
  await page.route(/\/api\/v1\/impact\/public(?:\?|$)/, route => {
    const url = new URL(route.request().url());
    state.requests.push(url);
    return route.fulfill({ json: { data: {
      from: url.searchParams.get('from'), to: url.searchParams.get('to'),
      metrics: [
        { metric: 'ITEMS_REVALUED', value: url.searchParams.has('from') ? '3' : '54', unit: 'COUNT' },
        { metric: 'REPAIRS_RECORDED', value: null, unit: 'COUNT' },
        { metric: 'COMPLETED_TRANSFERS', value: '6', unit: 'COUNT' },
        { metric: 'ESTIMATED_TRANSFER_WEIGHT', value: '7800', unit: 'GRAM' },
        { metric: 'CONFIRMED_SALE_VALUE', value: '9999999999999', unit: 'IDR' },
      ], weightCoverage: { known: '6', total: '8' }, notes,
    } } });
  });
  return state;
}

async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('dropdown status mendukung keyboard, pembatalan, pencarian huruf, dan pilihan aktif', async ({ page }) => {
  await mockPublic(page);
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { data: session(true) } }));
  await page.route('**/api/v1/listings/mine', route => route.fulfill({ json: { data: [] } }));
  await page.goto('/app/listings');
  const control = page.getByRole('combobox', { name: 'Status Listing' });
  await expect(control).toHaveText('Semua status');
  await control.focus();
  await control.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.getByRole('option', { name: 'Semua status' })).toHaveAttribute('aria-selected', 'true');
  await control.press('End');
  await expect(control).toHaveAttribute('aria-activedescendant', 'listing-status-options-9');
  await control.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(control).toHaveText('Semua status');
  await expect(control).toBeFocused();
  await control.press('t');
  await control.press('Enter');
  await expect(control).toHaveText('Tayang');
  await expect(page.locator('#listing-status-native')).toHaveValue('ACTIVE');
  await expect(page.getByText('Tidak ada Listing dengan status ini.')).toBeVisible();
  await control.click();
  await expect(page.getByRole('option', { name: 'Tayang', exact: true })).toHaveAttribute('aria-selected', 'true');
  await control.press('Tab');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await control.click();
  await page.getByRole('heading', { name: 'Listing saya' }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await fits(page);
});

test('dropdown Market mempertahankan filter dan opsi harga yang bersyarat', async ({ page }) => {
  const state = await mockPublic(page);
  await page.goto('/market');
  const sort = page.getByRole('combobox', { name: 'Urutkan' });
  await sort.click();
  await expect(page.getByRole('option', { name: 'Harga terendah' })).toHaveCount(0);
  await page.getByRole('option', { name: 'Kondisi terbaik' }).click();
  await expect(sort).toHaveText('Kondisi terbaik');
  await expect.poll(() => state.requests.some(url => url.searchParams.get('sort') === 'score_desc')).toBe(true);
  await page.getByRole('button', { name: 'Jual kembali', exact: true }).click();
  await sort.click();
  await page.getByRole('option', { name: 'Harga terendah' }).click();
  await expect.poll(() => state.requests.some(url => url.searchParams.get('sort') === 'price_asc')).toBe(true);
  await page.getByRole('button', { name: 'Donasi', exact: true }).click();
  await expect(sort).toHaveText('Terbaru');
  await fits(page);
});

test('dropdown kategori memvalidasi form dan menampilkan pilihan panjang tanpa overflow', async ({ page }) => {
  await mockPublic(page);
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { data: session(true) } }));
  const longLabel = 'Elektronik dan peralatan rumah tangga dengan nama kategori yang cukup panjang untuk dibaca pada layar kecil';
  await page.route('**/api/v1/me/notifications/summary', route => route.fulfill({ json: { data: { unreadCount: 0, recent: [] } } }));
  await page.route('**/api/v1/categories', route => route.fulfill({ json: { data: [{ code: 'electronics', name: longLabel, subcategories: [] }] } }));
  await page.goto('/app/barang/baru');
  const control = page.getByRole('combobox', { name: 'Kategori', exact: true });
  await expect(control).toHaveAttribute('aria-required', 'true');
  await page.getByLabel('Nama barang').fill('Barang uji dropdown');
  await page.getByLabel('Cerita singkat').fill('Keterangan barang untuk menguji validasi dropdown.');
  await page.getByRole('button', { name: 'Simpan barang', exact: true }).click();
  await expect(control).toBeFocused();
  await expect(control).toHaveAttribute('aria-invalid', 'true');
  await control.click();
  const option = page.getByRole('option', { name: longLabel, exact: true });
  await expect(option).toBeVisible();
  const panel = await page.getByRole('listbox').boundingBox();
  const viewport = page.viewportSize();
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(viewport.width);
  expect(panel.y + panel.height).toBeLessThanOrEqual(viewport.height);
  await option.click();
  await expect(control).toHaveText(longLabel);
  await expect(control).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#category-native')).toHaveValue('electronics');
  await fits(page);
});

test('dropdown Repair mengirim nilai form, dinonaktifkan saat menyimpan, dan kembali ke default setelah reset', async ({ page }) => {
  await mockPublic(page);
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { data: session(true) } }));
  const itemId = '00000000-0000-4000-8000-000000000015';
  await page.route(`**/api/v1/items/${itemId}`, route => route.fulfill({ json: { data: { id: itemId, version: 1, title: 'Barang uji', conditionSummary: 'Perlu diperiksa' } } }));
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ json: { data: { token: 'dropdown-test' } } }));
  let submitted;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route(`**/api/v1/items/${itemId}/repairs`, async route => {
    if (route.request().method() === 'POST') {
      submitted = route.request().postDataJSON();
      await pending;
      return route.fulfill({ json: { data: {} } });
    }
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto(`/app/barang/${itemId}/perbaikan`);
  const outcome = page.getByRole('combobox', { name: 'Hasil', exact: true });
  const cost = page.getByRole('combobox', { name: 'Jenis biaya', exact: true });
  await chooseOption(outcome, 'UNSUCCESSFUL');
  await chooseOption(cost, 'ESTIMATE');
  await page.getByLabel('Tindakan yang dilakukan').fill('Memeriksa komponen barang');
  await page.getByLabel('Biaya (Rp), opsional', { exact: true }).fill('25000');
  await page.getByRole('button', { name: 'Simpan Repair', exact: true }).click();
  await expect(outcome).toBeDisabled();
  await expect(cost).toBeDisabled();
  expect(submitted.outcome).toBe('UNSUCCESSFUL');
  expect(submitted.costKind).toBe('ESTIMATE');
  expect(submitted.costIdr).toBe(25000);
  release();
  await expect(outcome).toBeEnabled();
  await expect(outcome).toHaveText('Berhasil');
  await expect(cost).toHaveText('Biaya aktual');
  await expect(page.locator('#outcome-native')).toHaveValue('SUCCEEDED');
  await expect(page.locator('#costKind-native')).toHaveValue('ACTUAL');
  await fits(page);
});

test('kategori landing diteruskan ke Market dan kartu membuka detail yang sesuai', async ({ page }) => {
  const state = await mockPublic(page);
  await page.goto('/');
  await expect(page.locator('.preview-grid .market-card')).toHaveCount(3);
  await expect(page.locator('.landing-hero-actions a').last()).toHaveAttribute('href', '/daftar');
  await page.getByRole('button', { name: 'Buku', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Buku', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.preview-grid h3').first()).toHaveText('Demo Buku 11');
  expect(state.requests.some(url => url.searchParams.get('category') === 'books' && url.searchParams.get('limit') === '6')).toBe(true);
  await page.getByRole('link', { name: 'Lihat semua', exact: true }).click();
  await expect(page).toHaveURL(/\/market\?category=books$/);
  await expect(page.getByRole('button', { name: 'Buku', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.catalog-grid h3').first()).toHaveText('Demo Buku 11');
  await page.locator('.catalog-grid .market-card').first().click();
  await expect(page).toHaveURL(/\/market\/00000000-0000-4000-8000-000000000011$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Demo Buku 11');
  await fits(page);
});

test('jenis Listing, judul panjang, serta foto hilang dan gagal tetap terbaca', async ({ page }) => {
  const state = await mockPublic(page);
  const longTitle = 'Demo barang elektronik untuk ruang belajar bersama dengan keterangan kondisi dan kelengkapan yang cukup panjang agar tetap dapat dibaca pada ukuran layar kecil';
  state.customListings = [listing('RESELL', 11, 'electronics', { title: longTitle }), listing('DONATE', 12, 'books', { missing: true }), listing('EXCHANGE', 13, 'electronics', { broken: true })];
  await page.route('**/missing-public-ui-photo.png', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.locator('.preview-grid .market-card')).toHaveCount(3);
  await expect(page.locator('.market-card-bottom strong').nth(0)).toHaveText(/Rp\s*125\.000/);
  await expect(page.locator('.market-card-bottom strong').nth(1)).toHaveText('Tanpa biaya');
  await expect(page.locator('.market-card-bottom strong').nth(2)).toHaveText('Tukar barang');
  await expect(page.locator('.preview-grid h3').first()).toHaveAttribute('title', longTitle);
  await page.locator('.preview-grid .market-card').nth(2).scrollIntoViewIfNeeded();
  await expect(page.locator('.preview-grid .market-photo-empty')).toHaveCount(2);
  await fits(page);
});

test('kegagalan kategori dan Market dapat dipulihkan sampai keadaan kosong', async ({ page }) => {
  const state = await mockPublic(page);
  state.categoryError = true; state.marketError = true;
  await page.goto('/');
  await expect(page.locator('.preview-category-error')).toContainText('Kategori belum dapat dimuat.');
  await expect(page.locator('.preview-results')).toContainText('Barang dari Market belum dapat dimuat.');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  state.categoryError = false; state.marketError = false; state.empty = true;
  await page.locator('.preview-category-error').getByRole('button', { name: 'Coba lagi' }).click();
  await expect(page.getByRole('button', { name: 'Buku', exact: true })).toBeVisible();
  await page.locator('.preview-results').getByRole('button', { name: 'Coba lagi' }).click();
  await expect(page.locator('.preview-empty')).toContainText('Belum ada barang di pilihan ini.');
  await page.getByRole('button', { name: 'Buku', exact: true }).click();
  await page.getByRole('button', { name: 'Lihat semua kategori', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Semua', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await fits(page);
});

test('Impact mempertahankan lima metrik, periode, nilai kosong, dan sumber data', async ({ page }) => {
  const state = await mockPublic(page);
  await page.goto('/impact');
  await expect(page.locator('.impact-metric')).toHaveCount(5);
  await expect(page.locator('.impact-metric strong').first()).toHaveText('54');
  await expect(page.locator('.impact-metric strong').nth(1)).toHaveText('Belum tersedia');
  await expect(page.locator('.impact-metric strong').nth(3)).toHaveText('7,800 kg');
  for (const note of notes) await expect(page.getByText(note, { exact: true })).toBeVisible();
  await chooseOption(page.getByLabel('Periode laporan (Asia/Jakarta)'), '30');
  await expect(page.locator('.impact-metric strong').first()).toHaveText('3');
  expect(state.requests.some(url => url.pathname.endsWith('/impact/public') && url.searchParams.has('from') && url.searchParams.has('to'))).toBe(true);
  await fits(page);
});

test('CTA akun mengikuti sesi, skip link dan menu mendukung keyboard', async ({ page }) => {
  await mockPublic(page);
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { data: session(true) } }));
  await page.goto('/');
  await expect(page.locator('.landing-hero-actions a').last()).toHaveAttribute('href', '/app/barang/baru');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Langsung ke konten', exact: true })).toBeFocused();
  const menu = page.getByRole('button', { name: 'Buka menu', exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(page.locator('#public-mobile-navigation')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#public-mobile-navigation')).toHaveCount(0);
    await expect(menu).toBeFocused();
  }
  await fits(page);
});
