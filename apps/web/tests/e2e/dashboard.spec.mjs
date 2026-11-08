import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const id = n => '40000000-0000-4000-8000-' + String(n).padStart(12, '0');
const date = '2026-11-01T10:00:00Z';
const future = () => new Date(Date.now() + 86400000).toISOString();
const user = { id: id(1), displayName: 'Dara', email: 'dara@example.test', role: 'USER', status: 'ACTIVE', emailVerifiedAt: date,
  city: { id: id(2), name: 'Kota Kediri', code: '3571', provinceName: 'Jawa Timur' }, profilePhotoUrl: null };
const names = ['Keyboard mekanik', 'Kursi ruang kerja', 'Buku untuk sore hari', 'Lampu meja'];
const items = () => names.map((title, i) => ({ id: id(10 + i), title, categoryCode: ['electronics', 'furniture', 'books', 'household'][i], updatedAt: date, reservedByTransactionId: i === 1 ? id(99) : null,
  media: [{ id: id(20 + i), mime: 'image/webp', bytes: 1000, orderIndex: 0 }] }));
function offer(n, type = 'RESELL', status = 'PENDING') {
  return { id: id(n), listingId: id(100 + n), listingRevisionId: id(200 + n), bidderId: id(3), status, version: 1, expiresAt: future(), endReason: null, exchangeSnapshot: null, exchangeItemId: null, transactionId: null, createdAt: date,
    listing: { title: names[n % 4], type }, currentRevision: { id: id(n + 300), revisionNo: 1, priceIdr: 250000, message: 'Bisa bertemu akhir pekan ini?', proposedById: id(3), respondsById: user.id, createdAt: date, expiresAt: future() } };
}
const conversations = () => Array.from({ length: 4 }, (_, i) => ({ id: id(50 + i), listingId: id(100 + i), listingTitle: names[i], participant: { id: id(60 + i), displayName: ['Bima', 'Alya', 'Raka', 'Nadia'][i], profilePhotoUrl: null }, lastMessage: null, unreadCount: i === 3 ? 0 : i + 1, updatedAt: date, readSequence: 0, messageSequence: i + 1, peerReadSequence: 0 }));
const notifications = () => Array.from({ length: 3 }, (_, i) => ({ id: id(70 + i), type: i === 0 ? 'OFFER_RECEIVED' : i === 1 ? 'HANDOVER_REMINDER' : 'MESSAGE_RECEIVED', category: ['offers', 'transactions', 'messages'][i], title: ['Penawaran baru', 'Pengingat serah terima', 'Pesan baru'][i], message: 'Periksa aktivitas barangmu.', itemTitle: names[i], readAt: null, createdAt: date, latestMessageSequence: i === 2 ? 7 : undefined, target: { kind: ['OFFER', 'TRANSACTION', 'CONVERSATION'][i], id: id([30, 99, 50][i]) } }));
async function mock(page, options = {}) {
  const state = { items: items(), offers: [offer(30), offer(31, 'EXCHANGE', 'COUNTERED'), offer(32, 'DONATE')], messages: conversations(), notifications: notifications(), fail: new Set(), delay: 0, failPhoto: false, guest: false, profile: {}, requests: [], ...options };
  const ok = (route, data, meta) => route.fulfill({ json: { data, ...(meta ? { meta } : {}) } });
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.slice('/api/v1'.length);
    state.requests.push({ path, search: url.search, method: request.method(), csrf: request.headers()['x-csrf-token'], body: request.postDataJSON() });
    if (path === '/auth/session') return ok(route, { state: state.guest ? 'GUEST' : 'AUTHENTICATED', user: state.guest ? null : { ...user, ...state.profile }, sessionId: state.guest ? null : user.id, serverTime: new Date().toISOString(), expiresAt: future(), reauthenticatedUntil: null, reason: null });
    if (path === '/auth/csrf') return ok(route, { token: 'dashboard-fixture-csrf' });
    if (state.delay && ['/items', '/offers/mine', '/conversations', '/me/notifications'].includes(path)) await new Promise(done => setTimeout(done, state.delay));
    if (state.fail.has(path)) return route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Data belum tersedia.' } } });
    if (path === '/items') return ok(route, state.items.slice(0, Number(url.searchParams.get('limit') ?? 20)), { nextCursor: 'more-items' });
    if (path === '/offers/mine') return ok(route, state.offers);
    if (path.startsWith('/offers/')) return ok(route, state.offers.find(row => row.id === path.split('/').at(-1)));
    if (path === '/conversations') return ok(route, state.messages);
    if (path === '/me/notifications/summary') return ok(route, { unreadCount: state.notifications.filter(row => !row.readAt).length, recent: state.notifications });
    if (path === '/me/notifications') return ok(route, state.notifications.filter(row => !row.readAt).slice(0, 3), { nextCursor: null });
    if (path.endsWith('/read')) { state.notifications = state.notifications.map(row => row.id === path.split('/')[3] ? { ...row, readAt: date } : row); return ok(route, { read: true, readAt: date }); }
    if (/^\/media\/[^/]+\/access$/.test(path)) return state.failPhoto ? route.fulfill({ status: 403, json: { error: { code: 'FORBIDDEN', message: 'Foto tidak tersedia.' } } }) : ok(route, { url: '/images/keyboard.webp' });
    if (path === '/conversations/stream') return route.fulfill({ status: 204, body: '' });
    return ok(route, [], { nextCursor: null });
  });
  return state;
}
const offersPanel = page => page.getByRole('region', { name: 'Perlu tanggapan', exact: true });
const messagesPanel = page => page.getByRole('region', { name: 'Pesan baru', exact: true });
const newsPanel = page => page.getByRole('region', { name: 'Kabar terbaru', exact: true });

test('tall news does not leave a gap below offers and messages', async ({ page }, info) => {
  const state = await mock(page, { offers: [offer(30)], messages: [conversations()[0]] });
  state.notifications.forEach(row => { row.itemTitle = 'Barang dengan nama panjang untuk pemeriksaan jarak antarbagian di Ringkasan'; });
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/app');
  await expect(newsPanel(page).locator('li')).toHaveCount(3); await expect(page.locator('.item-card')).toHaveCount(4);
  const offers = await offersPanel(page).boundingBox(), messages = await messagesPanel(page).boundingBox();
  const recent = await page.getByRole('region', { name: 'Barang terbaru' }).boundingBox();
  const news = await newsPanel(page).boundingBox(), bottom = Math.max(offers.y + offers.height, messages.y + messages.height);
  expect(news.y + news.height).toBeGreaterThan(bottom + 60);
  expect(recent.y - bottom).toBeGreaterThanOrEqual(24); expect(recent.y - bottom).toBeLessThanOrEqual(33);
  expect(recent.x + recent.width).toBeLessThanOrEqual(news.x);
  await mkdir(resolve('../../.local/dashboard'), { recursive: true });
  await page.screenshot({ path: resolve(`../../.local/dashboard/spacing-${info.project.name}.png`), fullPage: true });
});

test('overview keeps real previews, private recent photos and direct routes', async ({ page }) => {
  const state = await mock(page);
  const waiting = offer(33); waiting.currentRevision.respondsById = id(3);
  state.offers.push(waiting, offer(34, 'RESELL', 'ACCEPTED'), { ...offer(35), expiresAt: '2020-01-01T00:00:00Z' });
  await page.goto('/app'); await expect(page.locator('.item-card')).toHaveCount(4);
  await expect(offersPanel(page).locator('li')).toHaveCount(3); await expect(messagesPanel(page).locator('li')).toHaveCount(3);
  await expect(offersPanel(page)).toContainText('Rp 250.000'); await expect(offersPanel(page)).toContainText('Tukar barang'); await expect(offersPanel(page)).toContainText('Permintaan donasi');
  await expect(offersPanel(page).locator('li a').first()).toHaveAttribute('href', `/app/penawaran/${id(30)}`);
  await expect(messagesPanel(page).locator('li a').first()).toHaveAttribute('href', `/pesan/${id(50)}`);
  await expect(page.getByRole('link', { name: 'Tambah barang', exact: true })).toHaveAttribute('href', '/app/barang/baru');
  await expect(page.locator('.item-card img')).toHaveCount(4);
  expect(state.requests.find(row => row.path === '/items').search).toBe('?limit=4');
  expect(new Set(state.requests.filter(row => row.path.endsWith('/access')).map(row => row.path)).size).toBe(4);
  expect(state.requests.some(row => row.method === 'POST')).toBe(false);
  await offersPanel(page).locator('li a').first().click(); await expect(page).toHaveURL(new RegExp(`/app/penawaran/${id(30)}$`));
});

test('cached offers leave the response panel as their deadline passes', async ({ page }) => {
  await page.clock.install(); const state = await mock(page, { offers: [offer(30)] });
  state.offers[0].expiresAt = new Date(Date.now() + 5000).toISOString();
  await page.goto('/app'); await expect(offersPanel(page).locator('li')).toHaveCount(1);
  await page.clock.runFor(16000); await expect(offersPanel(page).locator('li')).toHaveCount(0);
  await expect(offersPanel(page)).toContainText('Belum ada yang perlu ditanggapi.');
});

test('overview loading and section retries keep other data usable', async ({ page }) => {
  const state = await mock(page, { delay: 700, fail: new Set(['/offers/mine', '/conversations', '/me/notifications', '/items']) });
  await page.goto('/app'); await expect(offersPanel(page).getByRole('status')).toBeVisible(); await expect(newsPanel(page).getByRole('status')).toBeVisible();
  await expect(offersPanel(page)).toContainText('Penawaran gagal dimuat.'); await expect(messagesPanel(page)).toContainText('Pesan gagal dimuat.');
  await expect(newsPanel(page)).toContainText('Notifikasi gagal dimuat.');
  const recent = page.getByRole('region', { name: 'Barang terbaru' }); await expect(recent).toContainText('Barang gagal dimuat.');
  state.delay = 0; state.fail.delete('/offers/mine'); await offersPanel(page).getByRole('button', { name: 'Coba lagi' }).click();
  await expect(offersPanel(page).locator('li')).toHaveCount(3); await expect(messagesPanel(page)).toContainText('Pesan gagal dimuat.');
  for (const [path, region] of [['/conversations', messagesPanel(page)], ['/me/notifications', newsPanel(page)], ['/items', recent]]) {
    state.fail.delete(path); await region.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(region.getByRole('button', { name: 'Coba lagi' })).toHaveCount(0);
  }
  await expect(page.locator('.item-card')).toHaveCount(4);
});

test('first use has honest empty states and an add item route', async ({ page }, info) => {
  await mock(page, { items: [], offers: [], messages: [], notifications: [] }); await page.goto('/app');
  await expect(offersPanel(page)).toContainText('Belum ada yang perlu ditanggapi.'); await expect(messagesPanel(page)).toContainText('Belum ada pesan baru.');
  await expect(newsPanel(page)).toContainText('Belum ada kabar baru.'); await expect(page.getByRole('heading', { name: 'Mulai dari satu barang.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tambah barang pertama' })).toHaveAttribute('href', '/app/barang/baru');
  expect((await page.getByRole('link', { name: 'Tambah barang pertama' }).boundingBox()).y).toBeLessThan((await offersPanel(page).boundingBox()).y);
  await mkdir(resolve('../../.local/dashboard'), { recursive: true }); await page.screenshot({ path: resolve(`../../.local/dashboard/empty-${info.project.name}.png`), fullPage: true });
});

test('overview notification navigation retains read sequence and CSRF', async ({ page }) => {
  const state = await mock(page); state.notifications[0] = { ...state.notifications[2], id: id(70), target: { kind: 'OFFER', id: id(30) } };
  await page.goto('/app'); await expect(newsPanel(page).locator('li')).toHaveCount(3);
  await newsPanel(page).locator('.notification-entry-link').first().click(); await expect(page).toHaveURL(new RegExp(`/app/penawaran/${id(30)}$`));
  await expect.poll(() => state.requests.filter(row => row.path === `/me/notifications/${id(70)}/read`).length).toBe(1);
  expect(state.requests.find(row => row.path === `/me/notifications/${id(70)}/read`)).toMatchObject({ method: 'POST', csrf: 'dashboard-fixture-csrf', body: { throughSequence: 7 } });
});

test('missing revisions, denied photos and long names do not break overview layout', async ({ page }, info) => {
  const state = await mock(page, { failPhoto: true, profile: { displayName: 'Dara dengan nama lengkap yang lebih panjang untuk pemeriksaan tata letak' } });
  state.offers[0].currentRevision = null;
  state.offers[1].listing.title = 'Paket buku dengan nama barang yang panjang untuk dibaca bersama keluarga di rumah';
  state.messages[0].participant.displayName = 'Pengguna dengan nama lengkap yang sangat panjang';
  state.notifications[0].itemTitle = 'Keyboard dengan nama sangat panjang untuk kebutuhan bekerja dan belajar setiap hari';
  await mkdir(resolve('../../.local/dashboard'), { recursive: true });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/app');
    await expect(page.locator('.item-card')).toHaveCount(4); await expect(offersPanel(page).locator('li')).toHaveCount(2);
    await expect(page.locator('.item-card .private-photo-placeholder')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const positions = await page.locator('.dashboard-offers, .dashboard-messages').evaluateAll(els => els.map(el => ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y })));
    if (width >= 768) expect(positions[1].x).toBeGreaterThan(positions[0].x); else expect(positions[1].y).toBeGreaterThan(positions[0].y);
    for (const control of await page.locator('.dashboard-page button:visible, .dashboard-page a:visible').all()) expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
    if (width === 390 || width === 1440) await page.screenshot({ path: resolve(`../../.local/dashboard/long-${info.project.name}-${width}.png`), fullPage: true });
  }
});
