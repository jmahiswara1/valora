import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const user = { id: id(1), email: 'chat@demo.valora.local', displayName: 'Pengguna Chat', role: 'USER', status: 'ACTIVE', city: { id: id(8), name: 'Kota Kediri', code: '3571', provinceName: 'Jawa Timur' }, emailVerifiedAt: '2026-10-01T00:00:00Z', version: 1 };
const attachments = Array.from({ length: 3 }, (_, i) => ({ id: id(20 + i), mime: 'image/webp', bytes: 100, width: 800, height: 600, orderIndex: i }));
const message = (n, mine = false, photos = []) => ({ id: id(100 + n), conversationId: id(3), senderId: mine ? user.id : id(2), body: photos.length ? '' : `Pesan ${n}: barang masih berfungsi dan siap digunakan kembali.`, clientMessageId: id(200 + n), sequence: n, attachments: photos, sentAt: '2026-10-06T10:00:00Z' });
async function mock(page, count = 5) {
  const state = { rows: Array.from({ length: count }, (_, i) => message(i + 1, i % 2 === 1, i === count - 1 ? attachments : [])), read: 0, peerRead: 0, requests: [], commitFail: false, uploadFail: false, hidden: false, missingList: false, historyFailure: false, otherConversations: [], transactionId: null, listingTitle: 'Kamera untuk cerita berikutnya', listFailure: false, detailFailure: false, emailVerified: true };
  await page.addInitScript(() => {
    const original = window.EventSource;
    window.__chatStreams = 0;
    window.EventSource = class extends original { constructor(...args) { super(...args); window.__chatStreams++; } };
    window.__chatVisibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { get: () => window.__chatVisibility, configurable: true });
  });
  const conversation = () => ({ id: id(3), listingId: id(4), listingTitle: state.listingTitle, transactionId: state.transactionId, participant: { id: id(2), displayName: 'Nadia Putri', profilePhotoUrl: null }, lastMessage: state.rows.at(-1), unreadCount: state.rows.filter(m => m.senderId !== user.id && m.sequence > state.read).length, messageSequence: state.rows.at(-1)?.sequence ?? 0, readSequence: state.read, peerReadSequence: state.peerRead, updatedAt: '2026-10-06T10:00:00Z' });
  const ok = (route, data, meta) => route.fulfill({ json: { data, ...(meta ? { meta } : {}) } });
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.slice(7), method = req.method(), body = method === 'POST' ? req.postDataJSON() : null;
    state.requests.push({ path, method, body, search: url.search });
    if (path === '/auth/session') return ok(route, { state: 'AUTHENTICATED', sessionId: id(9), user: { ...user, emailVerifiedAt: state.emailVerified ? user.emailVerifiedAt : null }, serverTime: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() });
    if (path === '/auth/csrf') return ok(route, { token: 'chat-csrf' });
    if (path === '/conversations/stream') return route.fulfill({ status: 503, body: '' });
    if (path === '/conversations') return state.listFailure ? route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Daftar gagal dimuat.' } } }) : ok(route, state.missingList ? [] : [conversation(), ...state.otherConversations]);
    if (path === `/conversations/${id(3)}`) return state.detailFailure ? route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Detail gagal dimuat.' } } }) : ok(route, conversation());
    const other = state.otherConversations.find(row => path === `/conversations/${row.id}`);
    if (other) return ok(route, other);
    if (path === `/conversations/${id(3)}/messages/status`) { const row = state.rows.find(m => m.clientMessageId === url.searchParams.get('clientMessageId') && m.senderId === user.id); return ok(route, { committed: !!row, message: row ?? null }); }
    if (/^\/conversations\/[^/]+\/messages$/.test(path) && method === 'GET') {
      if (state.historyFailure) return route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Histori gagal dimuat.' } } });
      const before = Number(url.searchParams.get('before') ?? Infinity), rows = state.rows.filter(m => m.sequence < before), pageRows = rows.slice(-30);
      return ok(route, pageRows, { nextCursor: rows.length > 30 ? String(pageRows[0].sequence) : null });
    }
    if (path.endsWith('/read') && path.startsWith('/conversations/')) { state.read = Math.max(state.read, body.throughSequence); return ok(route, { readSequence: state.read, unreadCount: 0 }); }
    if (path.endsWith('/photos/tickets')) return ok(route, { ticketId: id(500 + state.requests.length), uploadUrl: '/api/v1/media/uploads/' + id(500 + state.requests.length), expiresAt: new Date(Date.now() + 900000).toISOString() });
    if (path.startsWith('/media/uploads/')) return state.uploadFail ? route.fulfill({ status: 400, json: { error: { code: 'MEDIA_INVALID', message: 'Foto tidak valid.' } } }) : ok(route, { mime: 'image/webp', bytes: 100 });
    if (path === `/conversations/${id(3)}/messages` && method === 'POST') { const existing = state.rows.find(m => m.clientMessageId === body.clientMessageId); const row = existing ?? { ...message(state.rows.length + 1, true, (body.ticketIds ?? []).map((_, index) => attachments[index])), body: body.body, clientMessageId: body.clientMessageId }; if (!existing) state.rows.push(row); return state.commitFail ? route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Respons terputus.' } } }) : ok(route, row); }
    if (path.startsWith('/message-photos/')) return ok(route, { url: '/images/keyboard.webp', expiresAt: new Date(Date.now() + 300000).toISOString() });
    if (path === '/reports') return ok(route, { id: id(700), status: 'OPEN' });
    if (path === '/me/notifications/summary') return ok(route, { unreadCount: 1, recent: [] });
    return ok(route, [], { nextCursor: null });
  });
  return state;
}
const payload = n => ({ name: `foto-${n}.webp`, mimeType: 'image/webp', buffer: Buffer.from('browser-upload-fixture') });

function fillInbox(state, count = 35) {
  state.otherConversations = Array.from({ length: count }, (_, i) => ({ id: id(800 + i), listingId: id(900 + i), listingTitle: `Barang pilihan ${i + 1}`, transactionId: null, participant: { id: id(1000 + i), displayName: `Anggota ${i + 1}`, profilePhotoUrl: null }, lastMessage: message(1), unreadCount: i % 2 ? 0 : 2, readSequence: 0, peerReadSequence: 0, messageSequence: 65, updatedAt: '2026-10-06T10:00:00Z' }));
}

async function expectWorkspaceFits(page) {
  await expect.poll(() => page.evaluate(() => {
    const composer = document.querySelector('.chat-composer')?.getBoundingClientRect();
    const history = document.querySelector('.chat-messages')?.getBoundingClientRect();
    const footer = document.querySelector('.chat-footer')?.getBoundingClientRect();
    return window.scrollY === 0 && document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1 && (!composer || composer.top >= footer.top && composer.bottom <= footer.bottom && composer.bottom <= innerHeight) && (!history || history.height > 80 && history.bottom <= composer.top);
  })).toBe(true);
}

async function expectLatestInHistory(page, sequence) {
  await expect.poll(() => page.locator(`[data-sequence="${sequence}"]`).evaluate(element => {
    const message = element.getBoundingClientRect(), history = element.closest('.chat-messages').getBoundingClientRect();
    return message.bottom <= history.bottom + 1 && message.bottom > history.top;
  })).toBe(true);
}

test('photos, receipt, profile, lightbox keyboard and responsive composition', async ({ page }, info) => {
  const state = await mock(page); state.peerRead = 4; state.missingList = true;
  await page.goto('/app/pesan/' + id(3));
  await expect(page.getByRole('heading', { name: 'Kamera untuk cerita berikutnya' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buka profil Nadia Putri' })).toHaveAttribute('href', '/profil/' + id(2));
  await expect(page.getByRole('img', { name: 'Dibaca', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('img', { name: 'Dibaca', exact: true }).first()).toHaveText('');
  await expect(page.getByRole('img', { name: 'Dibaca', exact: true }).first().locator('svg')).toHaveClass(/lucide-check-check/);
  await expect(page.locator('.message-photo-frame img').first()).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Buka foto 1 dari 3' }).first(); await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Foto dalam percakapan' })).toBeVisible(); await page.keyboard.press('ArrowRight'); await expect(page.getByText('Foto 2 dari 3', { exact: true })).toBeVisible(); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await page.getByLabel('Pilih foto pesan').setInputFiles([payload(1), payload(2), payload(3)]);
  await expect(page.getByText('Siap', { exact: true })).toHaveCount(3); await expect(page.getByRole('button', { name: 'Tambahkan foto' })).toBeDisabled();
  await page.getByRole('button', { name: 'Hapus foto 2' }).click(); await expect(page.getByText('Siap', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Kirim', exact: true }).click(); await expect(page.locator('.chat-draft-photos')).toHaveCount(0);
  expect(state.rows.at(-1).attachments).toHaveLength(2); expect(state.rows.at(-1).body).toBe('');
  expect(await page.evaluate(() => window.__chatStreams)).toBe(1);
  const targets = await page.locator('.chat-add-photo,.chat-message-report,.chat-composer .button').evaluateAll(elements => elements.map(e => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height }))); expect(targets.every(r => r.w >= 44 && r.h >= 44)).toBe(true);
  state.missingList = false; await page.reload(); await expect(page.getByRole('heading', { name: 'Kamera untuk cerita berikutnya' })).toBeVisible(); await expect(page.locator('.chat-message-mine .message-photo-frame img')).toHaveCount(2);
  await page.addStyleTag({ content: 'nextjs-portal { visibility: hidden; }' });
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await expect(page.locator('.chat-compose-area')).toHaveCSS('position', 'static');
  await expectWorkspaceFits(page);
  await expect(page.locator('#message-body')).toHaveCSS('color', 'rgb(27, 58, 40)');
  const placeholder = await page.locator('#message-body').evaluate(element => getComputedStyle(element, '::placeholder').color); expect(placeholder).toBe('rgb(91, 109, 96)');
  const folder = resolve('.impeccable/review/chat'); await mkdir(folder, { recursive: true }); await page.screenshot({ path: resolve(folder, `${info.project.name}.png`), fullPage: true });
  if (info.project.name === 'mobile') { await page.setViewportSize({ width: 320, height: 844 }); await page.evaluate(() => window.scrollTo(0, 0)); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: resolve(folder, 'mobile-320.png'), fullPage: true }); }
});
test('upload errors preserve draft and uncertain commits recover without duplicate send', async ({ page }) => {
  const state = await mock(page); await page.goto('/app/pesan/' + id(3)); state.uploadFail = true;
  await page.getByLabel('Pesan', { exact: true }).fill('Ini foto kondisinya.'); await page.getByLabel('Pilih foto pesan').setInputFiles(payload(1));
  await expect(page.getByText('Unggah gagal', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Kirim', exact: true })).toBeDisabled();
  state.uploadFail = false; await page.getByRole('button', { name: 'Coba lagi', exact: true }).click(); await expect(page.getByText('Siap', { exact: true })).toBeVisible();
  state.commitFail = true; await page.getByRole('button', { name: 'Kirim', exact: true }).click(); await expect(page.getByRole('button', { name: 'Periksa status pesan' })).toBeVisible(); await expect(page.getByLabel('Pesan', { exact: true })).toHaveValue('Ini foto kondisinya.');
  await page.getByRole('button', { name: 'Periksa status pesan' }).click(); await expect(page.getByLabel('Pesan', { exact: true })).toHaveValue(''); expect(state.requests.filter(r => r.path.endsWith('/messages') && r.method === 'POST')).toHaveLength(1);
});
test('read waits for visible loaded messages and history pagination preserves position', async ({ page }) => {
  const state = await mock(page, 65); state.historyFailure = true;
  await page.goto('/app/pesan/' + id(3)); await expect(page.getByText('Histori pesan gagal dimuat.')).toBeVisible(); expect(state.read).toBe(0);
  await page.evaluate(() => { window.__chatVisibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); }); state.historyFailure = false;
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click(); await expect(page.locator('[data-sequence="65"]')).toBeVisible(); expect(state.read).toBe(0);
  await page.evaluate(() => { window.__chatVisibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); }); await expect.poll(() => state.read).toBe(65);
  await page.locator('.chat-messages').evaluate(e => { e.scrollTop = 0; }); await page.getByRole('button', { name: 'Muat pesan sebelumnya' }).click(); await expect(page.locator('[data-sequence="6"]')).toBeAttached(); await expect.poll(() => page.locator('.chat-messages').evaluate(e => e.scrollTop)).toBeGreaterThan(100);
  await expect(page.getByRole('button', { name: 'Laporkan pesan ini' }).first()).toBeAttached();
});

test('long inbox and history scroll independently with a compact agreement and visible composer', async ({ page }, info) => {
  const state = await mock(page, 65); fillInbox(state); state.transactionId = id(600);
  state.listingTitle = 'Perlengkapan menggambar dasar untuk berkarya bersama dengan judul barang yang sangat panjang dan tetap mudah dibaca';
  state.emailVerified = false;
  await page.goto('/app/pesan/' + id(3));
  await expect(page.locator('[data-sequence="65"]')).toBeAttached();
  await expectWorkspaceFits(page); await expectLatestInHistory(page, 65);
  const agreement = page.getByRole('link', { name: 'Buka kesepakatan', exact: true });
  await expect(agreement).toHaveAttribute('href', '/app/transaksi/' + id(600));
  const button = await agreement.boundingBox(); expect(button.height).toBeGreaterThanOrEqual(44); expect(button.height).toBeLessThanOrEqual(52); expect(button.width).toBeLessThan(240);
  const headerBounds = await page.locator('.chat-header').boundingBox(); expect(button.y + button.height).toBeLessThanOrEqual(headerBounds.y + headerBounds.height);
  const history = page.locator('.chat-messages'), list = page.locator('.conversation-scroll');
  if (info.project.name === 'desktop') {
    const historyTop = await history.evaluate(element => element.scrollTop);
    await list.hover(); await page.mouse.wheel(0, 550);
    await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(100);
    expect(await history.evaluate(element => element.scrollTop)).toBe(historyTop);
    const listTop = await list.evaluate(element => element.scrollTop), header = await page.locator('.chat-header').boundingBox();
    await history.hover(); await page.mouse.wheel(0, -600);
    await expect.poll(() => history.evaluate(element => element.scrollTop)).toBeLessThan(historyTop - 100);
    expect(await list.evaluate(element => element.scrollTop)).toBe(listTop);
    expect((await page.locator('.chat-header').boundingBox()).y).toBe(header.y);
    await page.setViewportSize({ width: 1280, height: 720 }); await expectWorkspaceFits(page);
    await page.setViewportSize({ width: 900, height: 900 }); await expectWorkspaceFits(page);
  } else {
    await expect(page.locator('.account-conversation-pane')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Semua percakapan', exact: true })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 844 }); await expectWorkspaceFits(page);
  }
  await history.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.getByLabel('Pilih foto pesan').setInputFiles([payload(1), payload(2), payload(3)]);
  await expect(page.getByText('Siap', { exact: true })).toHaveCount(3);
  await expectWorkspaceFits(page); await expectLatestInHistory(page, 65);
  await history.evaluate(element => { element.scrollTop = 150; });
  const before = await history.evaluate(element => element.scrollTop);
  await page.getByRole('button', { name: 'Hapus foto 2' }).click();
  await expect.poll(() => history.evaluate(element => element.scrollTop)).toBe(before);
  state.rows.push(message(66));
  await expect(page.locator('[data-sequence="66"]')).toBeAttached();
  expect(await history.evaluate(element => element.scrollTop)).toBe(before);
  await expectWorkspaceFits(page);
});

test('inbox search and unread filter compose without affecting the open thread', async ({ page }, info) => {
  const state = await mock(page); fillInbox(state, 6);
  await page.goto('/app/pesan');
  const list = page.locator('.conversation-list'); await expect(list.locator('.conversation-row')).toHaveCount(7);
  const search = page.getByRole('searchbox', { name: 'Cari percakapan' });
  await search.focus(); await page.keyboard.type('aNGGota'); await expect(list.locator('.conversation-row')).toHaveCount(6);
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Hapus pencarian', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Belum dibaca', exact: true }).click(); await expect(list.locator('.conversation-row')).toHaveCount(3);
  await search.fill('barang pilihan 2'); await expect(page.getByText('Tidak ada percakapan yang cocok.')).toBeVisible();
  await page.getByRole('button', { name: 'Hapus filter', exact: true }).click(); await expect(search).toHaveValue(''); await expect(list.locator('.conversation-row')).toHaveCount(7);
  await search.fill('KAMERA'); await expect(list.locator('.conversation-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Hapus pencarian', exact: true }).click();
  await expectWorkspaceFits(page);
  const folder = resolve('.impeccable/review/chat'); await mkdir(folder, { recursive: true });
  await page.screenshot({ path: resolve(folder, `inbox-${info.project.name}.png`), fullPage: true });
  await list.locator('.conversation-row').first().click();
  await expect(page.getByRole('heading', { name: 'Kamera untuk cerita berikutnya' })).toBeVisible();
  if (info.project.name === 'desktop') {
    await search.fill('tidak ditemukan');
    await expect(page.getByText('Tidak ada percakapan yang cocok.')).toBeVisible();
    await expect(page.locator('.chat-messages')).toBeVisible();
    await search.fill('Anggota 1'); await list.locator('.conversation-row').click();
    await expect(page.getByRole('heading', { name: 'Barang pilihan 1', exact: true })).toBeVisible();
    await expectLatestInHistory(page, 5);
  } else {
    await page.getByRole('link', { name: 'Semua percakapan', exact: true }).click();
    await expect(search).toBeVisible();
    await expect(page.locator('.chat-messages')).toHaveCount(0);
  }
});

test('inbox loading, empty and retry states stay inside the message workspace', async ({ page }) => {
  const state = await mock(page); state.listFailure = true;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/v1/conversations', async route => { await pending; await route.fallback(); });
  await page.goto('/app/pesan');
  await expect(page.locator('.conversation-scroll .account-skeleton').first()).toBeVisible();
  release();
  await expect(page.getByText('Percakapan gagal dimuat.')).toBeVisible();
  state.listFailure = false; state.missingList = true;
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(page.getByText('Belum ada percakapan.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Jelajahi Market' })).toHaveAttribute('href', '/market');
  await expectWorkspaceFits(page);
  state.detailFailure = true;
  await page.goto('/app/pesan/' + id(3));
  await expect(page.getByText('Percakapan gagal dimuat.')).toBeVisible();
  state.detailFailure = false;
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(page.locator('.chat-messages')).toBeVisible();
  await expectWorkspaceFits(page);
});
