import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const id = n => '30000000-0000-4000-8000-' + String(n).padStart(12, '0');
const future = () => new Date(Date.now() + 2 * 86400000).toISOString();
const user = { id: id(1), displayName: 'Dara', email: 'collections@example.test', role: 'USER', status: 'ACTIVE', emailVerifiedAt: '2026-11-01T00:00:00Z', city: { id: id(8), name: 'Kota Kediri', code: '3571', provinceName: 'Jawa Timur' }, version: 1, profilePhotoUrl: null };
const statuses = { DRAFT: 'Draft', PENDING_REVIEW: 'Menunggu review', ACTIVE: 'Tayang', PAUSED: 'Dijeda', RESERVED: 'Dalam kesepakatan', CLOSED: 'Ditutup', REJECTED: 'Perlu perbaikan', WITHDRAWN: 'Ditarik', SUSPENDED: 'Ditangguhkan' };
const snapshot = n => ({ id: id(n), title: 'Barang paket ' + n, description: 'Barang siap digunakan kembali.', conditionSummary: 'Berfungsi baik', mediaIds: [id(900 + n)], fromUserId: id(2), toUserId: user.id });
function offer(n, extra = {}) {
  return { id: id(n), listingId: id(100 + n), listingRevisionId: id(200 + n), bidderId: id(2), exchangeSnapshot: null, exchangeItemId: null, transactionId: null, status: 'PENDING', endReason: null, expiresAt: future(), version: 7, createdAt: '2026-11-01T00:00:00Z',
    listing: { title: 'Penawaran barang ' + n, type: 'RESELL' }, currentRevision: { id: id(300 + n), revisionNo: 2, priceIdr: 300000, message: 'Apakah bisa bertemu akhir pekan ini?', proposedById: id(2), respondsById: user.id, createdAt: '2026-11-01T00:00:00Z', expiresAt: future() }, ...extra };
}
function offers() {
  const waiting = offer(11, { bidderId: user.id }); waiting.currentRevision.respondsById = id(2);
  const counter = offer(13, { bidderId: user.id, status: 'COUNTERED', listing: { title: 'Paket buku untuk ditukar', type: 'EXCHANGE' } });
  counter.currentRevision.exchangeTerms = { ownerItems: [snapshot(81), snapshot(82)], bidderItems: [snapshot(83)], cashAdjustment: { payer: 'OWNER', amountIdr: 50000 } };
  counter.currentRevision.termsHash = 'a'.repeat(64);
  return [waiting, offer(12), counter, offer(14, { status: 'ACCEPTED', transactionId: id(99), listing: { title: 'Buku untuk didonasikan', type: 'DONATE' } }), offer(15, { expiresAt: '2020-01-01T00:00:00Z' }), offer(16, { bidderId: user.id, status: 'WITHDRAWN' })];
}
function listings(count = 25) {
  return Array.from({ length: count }, (_, i) => ({ id: id(400 + i), itemId: id(500 + i), status: Object.keys(statuses)[i % 9], type: ['RESELL', 'EXCHANGE', 'DONATE'][i % 3], version: 1, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z', currentRevision: {
    id: id(600 + i), title: 'Barang ' + String(i + 1).padStart(2, '0'), city: user.city, askingPriceIdr: 250000, media: [{ id: id(700 + i), mime: 'image/webp', bytes: 1000, orderIndex: 0 }] } }));
}
async function mock(page, options = {}) {
  const state = { offers: offers(), listings: listings(), failOffers: false, failListings: false, failMutation: false, failPhoto: false, delay: 0, writes: [], requests: [], ...options };
  const ok = (route, data, meta) => route.fulfill({ json: { data, ...(meta ? { meta } : {}) } });
  const fail = route => route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Koneksi belum tersedia.' } } });
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.slice('/api/v1'.length);
    state.requests.push({ path, method: request.method() });
    if (path === '/auth/session') return ok(route, { state: 'AUTHENTICATED', reason: null, user, sessionId: user.id, serverTime: new Date().toISOString(), expiresAt: future(), reauthenticatedUntil: future() });
    if (path === '/auth/csrf') return ok(route, { token: 'collections-csrf' });
    if (path === '/me/notifications/summary') return ok(route, { unreadCount: 0, recent: [] });
    if (path === '/offers/mine' || path === '/listings/mine') { if (state.delay) await new Promise(done => setTimeout(done, state.delay)); return (path === '/offers/mine' ? state.failOffers : state.failListings) ? fail(route) : ok(route, path === '/offers/mine' ? state.offers : state.listings); }
    if (/^\/offers\/[^/]+$/.test(path)) return ok(route, state.offers.find(row => row.id === path.split('/').at(-1)));
    if (path.startsWith('/offers/') && request.method() === 'POST') {
      const body = request.postDataJSON(), row = state.offers.find(row => row.id === path.split('/')[2]);
      state.writes.push({ path, body, csrf: request.headers()['x-csrf-token'], key: request.headers()['idempotency-key'] });
      if (state.failMutation) return fail(route);
      row.version++;
      if (path.endsWith('/counter')) { row.status = 'COUNTERED'; row.currentRevision = { ...row.currentRevision, priceIdr: body.priceIdr, message: body.message, revisionNo: row.currentRevision.revisionNo + 1, respondsById: id(2) }; }
      else row.status = path.endsWith('/reject') ? 'REJECTED' : path.endsWith('/withdraw') ? 'WITHDRAWN' : 'ACCEPTED';
      return ok(route, path.endsWith('/accept') ? { id: id(99) } : row);
    }
    if (path === `/transactions/${id(99)}`) return ok(route, { id: id(99), type: 'RESELL', status: 'AWAITING_HANDOVER', sellerOrDonorId: user.id, buyerOrRecipientId: id(2), version: 1, finalPriceIdr: 300000, acceptedAt: future(), targetHandoverAt: future(), overdueAt: null, correctedAt: null, cancellations: [], confirmations: [], disputes: [], corrections: [], requiredConfirmations: [], conversationId: null, snapshot: { parties: [user, { id: id(2), displayName: 'Bima' }], items: [snapshot(81)], handoverMethods: ['MEETUP'] } });
    if (path.endsWith('/handover')) return ok(route, { version: 1, deadlineAt: future(), agreed: null, pending: null, directions: [], permissions: { canPropose: false, canRespond: false, canWithdraw: false } });
    if (/^\/media\/[^/]+\/access$/.test(path)) return state.failPhoto ? fail(route) : ok(route, { url: '/images/keyboard.webp' });
    return ok(route, [], { nextCursor: null });
  });
  return state;
}
const row = (page, n) => page.locator(`[data-offer-id="${id(n)}"]`);
async function choose(page, label, option) { await page.getByLabel(label, { exact: true }).click(); await page.getByRole('option', { name: option, exact: true }).click(); }

test('offers prioritize the current responder and combine activity, direction, type and search filters', async ({ page }) => {
  await mock(page); await page.goto('/app/penawaran'); await expect(page.locator('.offer-list-row')).toHaveCount(6);
  await expect(page.locator('.offer-list-row').first()).toHaveAttribute('data-offer-id', id(12));
  await page.getByRole('button', { name: 'Perlu tanggapan', exact: true }).click(); await expect(page.locator('.offer-list-row')).toHaveCount(2);
  await choose(page, 'Arah penawaran', 'Keluar'); await expect(page.locator('.offer-list-row')).toHaveCount(1); await expect(row(page, 13)).toBeVisible();
  await page.getByRole('group', { name: 'Jenis penawaran' }).getByRole('button', { name: 'Tukar barang', exact: true }).click();
  await page.getByLabel('Cari penawaran', { exact: true }).fill('TIDAK ADA'); await expect(page.getByRole('heading', { name: 'Tidak ada penawaran yang cocok.' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filter', exact: true }).click(); await expect(page.locator('.offer-list-row')).toHaveCount(6);
  await page.getByRole('button', { name: 'Selesai', exact: true }).click(); await expect(page.locator('.offer-list-row')).toHaveCount(3);
  await expect(row(page, 15)).toContainText('Tenggat terlewati.'); await expect(row(page, 15).getByRole('button')).toHaveCount(0);
  await expect(row(page, 14).getByRole('link', { name: 'Buka transaksi', exact: true })).toHaveAttribute('href', `/app/transaksi/${id(99)}`);
});

test('counteroffer stays inline, validates its amount and updates the response turn', async ({ page }) => {
  const state = await mock(page); await page.goto('/app/penawaran'); const target = row(page, 12);
  await target.getByRole('button', { name: 'Buat counteroffer' }).click();
  await target.getByLabel('Nominal counteroffer').fill('0'); await target.getByRole('button', { name: 'Kirim counteroffer' }).click(); expect(state.writes).toHaveLength(0);
  await target.getByLabel('Nominal counteroffer').fill('230000'); await target.getByLabel('Pesan (opsional)').fill('Bisa di nominal ini.');
  await target.getByRole('button', { name: 'Kirim counteroffer' }).click(); await expect(target).toContainText('Status penawaran diperbarui.');
  expect(state.writes[0]).toMatchObject({ path: `/offers/${id(12)}/counter`, body: { expectedVersion: 7, priceIdr: 230000, message: 'Bisa di nominal ini.' }, csrf: 'collections-csrf' });
  await page.getByRole('button', { name: 'Perlu tanggapan', exact: true }).click(); await expect(row(page, 12)).toHaveCount(0);
  await page.getByRole('button', { name: 'Menunggu pihak lain', exact: true }).click(); await expect(row(page, 12)).toBeVisible();
});

test('reject and withdraw remain available only to the right participant', async ({ page }) => {
  const state = await mock(page); await page.goto('/app/penawaran');
  await expect(row(page, 12).getByRole('button', { name: 'Tarik penawaran' })).toHaveCount(0);
  await expect(row(page, 11).getByRole('button', { name: 'Terima penawaran' })).toHaveCount(0);
  await row(page, 12).getByRole('button', { name: 'Tolak', exact: true }).click(); await expect(row(page, 12).locator('.collection-status')).toHaveText('Ditolak');
  await row(page, 11).getByRole('button', { name: 'Tarik penawaran' }).click(); await expect(row(page, 11).locator('.collection-status')).toHaveText('Ditarik');
  expect(state.writes).toHaveLength(2); expect(state.writes.every(write => write.body.expectedVersion === 7 && write.csrf === 'collections-csrf')).toBe(true);
});

test('exchange summary keeps bundle sizes, cash direction and accept consent payload', async ({ page }) => {
  const state = await mock(page); await page.goto('/app/penawaran'); const target = row(page, 13);
  await expect(target).toContainText('Pemilik Listing: 2 barang · Penawar: 1 barang'); await expect(target).toContainText('Pihak lain menambah Rp');
  await target.getByRole('button', { name: 'Terima penawaran', exact: true }).click(); const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Terima dan reservasi barang' })).toBeDisabled(); expect(state.writes).toHaveLength(0);
  await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Terima dan reservasi barang' }).click();
  await expect(page).toHaveURL(new RegExp(`/app/transaksi/${id(99)}$`));
  expect(state.writes[0].body).toEqual({ expectedVersion: 7, offerRevisionId: id(313), listingRevisionId: id(213), exchangeTermsHash: 'a'.repeat(64) }); expect(state.writes[0].key).toBeTruthy();
});

test('failed inline counter preserves its draft and offer detail keeps its existing presentation', async ({ page }) => {
  const state = await mock(page, { failMutation: true }); await page.goto('/app/penawaran'); const target = row(page, 12);
  await target.getByRole('button', { name: 'Buat counteroffer' }).click(); await target.getByLabel('Nominal counteroffer').fill('240000');
  await target.getByRole('button', { name: 'Kirim counteroffer' }).click(); await expect(target).toContainText('Koneksi belum tersedia.'); await expect(target.getByLabel('Nominal counteroffer')).toHaveValue('240000');
  state.failMutation = false; await target.getByRole('button', { name: 'Kirim counteroffer' }).click(); await expect(target).toContainText('Status penawaran diperbarui.');
  await target.getByRole('link', { name: /Lihat seluruh kesepakatan/ }).click(); await expect(page.getByRole('heading', { name: 'Detail penawaran', exact: true })).toBeVisible();
  await expect(page.locator('.offer-list-row')).toHaveCount(0); await expect(page.locator('.offer-card')).toHaveCount(1);
});

test('a cached pending offer stops requiring a response after its deadline', async ({ page }) => {
  await page.clock.install(); const entries = offers(); entries[1].expiresAt = new Date(Date.now() + 5000).toISOString();
  await mock(page, { offers: entries }); await page.goto('/app/penawaran'); await page.getByRole('button', { name: 'Perlu tanggapan', exact: true }).click(); await expect(row(page, 12)).toBeVisible();
  await page.clock.fastForward(20000); await expect(row(page, 12)).toHaveCount(0);
});

test('listing batches reset with combined status, type and name filters', async ({ page }) => {
  const state = await mock(page); await page.goto('/app/listings'); await expect(page.locator('.owner-listing-card')).toHaveCount(12);
  expect(state.requests.some(request => request.path === `/media/${id(712)}/access`)).toBe(false);
  await page.getByRole('button', { name: 'Muat lebih banyak', exact: true }).click(); await expect(page.locator('.owner-listing-card')).toHaveCount(24);
  await page.getByRole('group', { name: 'Jenis Listing' }).getByRole('button', { name: 'Tukar barang', exact: true }).click();
  await choose(page, 'Status Listing', 'Dalam kesepakatan'); await page.getByLabel('Cari Listing', { exact: true }).fill('Barang 05'); await expect(page.locator('.owner-listing-card')).toHaveCount(1);
  await expect(page.locator('.owner-listing-card')).toHaveAttribute('href', `/app/listings/${id(404)}`);
  await page.getByRole('button', { name: 'Reset filter', exact: true }).click(); await expect(page.locator('.owner-listing-card')).toHaveCount(12);
  for (const label of Object.values(statuses)) { await choose(page, 'Status Listing', label); await expect(page.locator('.owner-listing-card').first().locator('.collection-status')).toHaveText(label); }
});

test('drafts, unavailable photos, and all listing types have honest content', async ({ page }) => {
  const entries = listings(3); entries[0].currentRevision = null;
  await mock(page, { listings: entries, failPhoto: true }); await page.goto('/app/listings');
  await expect(page.getByRole('heading', { name: 'Draft tanpa revisi', exact: true })).toBeVisible();
  await expect(page.locator('.owner-listing-card').first()).toContainText('Harga belum diisi'); await expect(page.locator('.owner-listing-card').first()).toContainText('Lokasi belum ditentukan');
  await expect(page.locator('.owner-listing-photo .private-photo-placeholder')).toHaveCount(3);
  await expect(page.locator('.owner-listing-price')).toHaveText(['Harga belum diisi', 'Tukar barang', 'Donasi']);
});

for (const [path, key, title] of [['/app/penawaran', 'Offers', 'Penawaran'], ['/app/listings', 'Listings', 'Listing saya']]) {
  test(`${title} has loading, retry, empty and capped result states`, async ({ page }) => {
    const state = await mock(page, { ['fail' + key]: true, delay: 800 }); await page.goto(path);
    await expect(page.getByRole('status', { name: 'Memuat data', exact: true })).toBeVisible(); await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByRole('button', { name: 'Coba lagi', exact: true })).toBeVisible(); await expect(page.locator('.collection-result-count')).toHaveCount(0);
    state['fail' + key] = false; state.delay = 0; state[key.toLowerCase()] = [];
    await page.getByRole('button', { name: 'Coba lagi', exact: true }).click(); await expect(page.getByRole('heading', { name: key === 'Offers' ? 'Belum ada penawaran.' : 'Belum ada Listing.', exact: true })).toBeVisible();
    state[key.toLowerCase()] = key === 'Offers' ? Array.from({ length: 100 }, (_, n) => offer(1000 + n, { status: 'REJECTED' })) : listings(100);
    await page.reload(); await expect(page.locator('.collection-result-count')).toContainText(key === 'Offers' ? '100 penawaran terbaru' : '100 Listing terbaru');
  });
}

test('both collection layouts fit long content on supported viewport widths', async ({ page }, info) => {
  const state = await mock(page, { listings: listings(6) }); state.offers[1].listing.title = 'Keyboard mekanik dengan nama barang yang lebih panjang untuk kerja dan belajar';
  state.listings[0].currentRevision.title = 'Keyboard mekanik dengan nama barang yang lebih panjang untuk kerja dan belajar';
  await mkdir(resolve('../../.local/collections'), { recursive: true });
  for (const path of ['/app/penawaran', '/app/listings']) for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(path);
    await expect(page.locator(path.endsWith('listings') ? '.owner-listing-card' : '.offer-list-row')).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const button of await page.locator('.account-collection-page button:visible').all()) expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    if (width === 390 || width === 1440) await page.screenshot({ path: resolve(`../../.local/collections/${path.split('/').at(-1)}-${info.project.name}-${width}.png`) });
  }
});
