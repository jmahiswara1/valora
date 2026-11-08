import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const meetingInput = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16);
const now = () => new Date().toISOString(), future = () => new Date(Date.now() + 2 * 86400000).toISOString();
const user = n => ({ id: id(n), displayName: n === 2 ? 'Dara' : 'Bima', email: 'fixture@valora.local', role: 'USER', status: 'ACTIVE', emailVerified: true, emailVerifiedAt: now(), version: 1, profilePhotoUrl: null, city: { id: id(9), name: 'Kota Kediri', province: 'Jawa Timur' } });
const tx = () => ({ id: id(10), listingId: id(11), offerId: id(12), type: 'RESELL', status: 'AWAITING_HANDOVER', sellerOrDonorId: id(2), buyerOrRecipientId: id(3), finalPriceIdr: 250000, snapshot: { parties: [user(2), user(3)], items: [{ id: id(20), title: 'Keyboard mekanik', description: 'Keyboard siap digunakan kembali.', conditionSummary: 'Bekas pakai ringan.', mediaIds: [], fromUserId: id(2), toUserId: id(3) }], handoverMethods: ['MEETUP', 'DELIVERY'] }, acceptedAt: now(), targetHandoverAt: new Date(Date.now() + 14 * 86400000).toISOString(), completedAt: null, correctedAt: null, overdueAt: null, cancellations: [], confirmations: [], disputes: [], corrections: [], requiredConfirmations: [], conversationId: null, version: 1 });
const plan = (method = 'MEETUP') => ({ id: id(30), transactionId: id(10), proposedById: id(2), method, plannedAt: future(), timeZone: 'Asia/Jakarta', status: 'APPROVED', createdAt: now(), respondedAt: now(), respondedById: id(3), purgedAt: null, endReason: null, privateDetails: { location: method === 'MEETUP' ? 'Perpustakaan Kota Kediri, lobi utama' : null, note: 'Hubungi lewat percakapan saat berangkat.', responseReason: null, destinations: method === 'DELIVERY' ? [{ userId: id(3), details: { recipientName: 'Bima', phone: '081234567890', address: 'Jalan Melati nomor 12, Kota Kediri' } }] : [] } });
async function mock(page, options = {}) {
  const state = { actor: 2, version: 1, pending: null, agreed: null, writes: [], requests: [], conversationId: id(88), fail: false, recovery: false, locked: false, resi: null, timelineMore: false, ...options };
  const conversation = () => ({ id: state.conversationId, transactionId: id(10), listingId: id(11), listingTitle: 'Keyboard mekanik', participant: user(state.actor === 2 ? 3 : 2), lastMessage: null, unreadCount: 0, readSequence: 0, peerReadSequence: 0, messageSequence: 0, updatedAt: now() });
  const coordination = () => ({ transactionId: id(10), version: state.version, deadlineAt: tx().targetHandoverAt, serverTime: now(), agreed: state.agreed, pending: state.pending, directions: [{ itemId: id(20), title: 'Keyboard mekanik', fromUserId: id(2), toUserId: id(3), received: state.locked, canRecord: state.actor === 2 && state.agreed?.method === 'DELIVERY' && !state.locked, shipment: state.resi }], permissions: { canPropose: !state.pending && !state.locked, canRespond: !!state.pending && state.actor !== 2 && !state.locked, canWithdraw: !!state.pending && state.actor === 2 && !state.locked, reason: state.locked ? 'Koordinasi dikunci setelah serah terima dimulai atau transaksi ditutup.' : null } });
  const ok = (route, data, meta) => route.fulfill({ json: { data, ...(meta ? { meta } : {}) } });
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.slice(7);
    state.requests.push({ path, method: req.method() });
    if (path === '/auth/session') return ok(route, { state: 'AUTHENTICATED', user: { ...user(state.actor), role: state.admin ? 'ADMIN' : 'USER' }, sessionId: id(99), serverTime: now(), expiresAt: future(), reauthenticatedUntil: future(), reason: null });
    if (path === '/me') return ok(route, { ...user(state.actor), role: state.admin ? 'ADMIN' : 'USER' }); if (path === '/auth/csrf') return ok(route, { token: 'fixture-handover-csrf' }); if (path === '/me/notifications/summary') return ok(route, { unreadCount: 0, recent: [] });
    if (path === '/me/actions/status') return ok(route, { status: state.recovery ? 'COMMITTED' : 'NOT_FOUND', completedAt: now() });
    if (path === '/transactions/' + id(10)) return ok(route, { ...tx(), version: state.version, conversationId: state.conversationId });
    if (path === '/conversations') return ok(route, state.conversationId ? [conversation()] : []);
    if (state.conversationId && path === `/conversations/${state.conversationId}`) return ok(route, conversation());
    if (state.conversationId && path === `/conversations/${state.conversationId}/messages`) return ok(route, [], { nextCursor: null });
    if (path.endsWith('/timeline') && url.searchParams.has('cursor') && state.timelineFail) return route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Halaman berikutnya gagal.' } } });
    if (path.endsWith('/timeline')) return ok(route, [{ id: url.searchParams.has('cursor') ? 'older' : 'newer', type: 'HANDOVER_APPROVED', actorId: id(3), label: url.searchParams.has('cursor') ? 'Penawaran disepakati' : 'Koordinasi serah terima disepakati', occurredAt: now(), proposalId: id(30), itemId: null }], { nextCursor: state.timelineMore && !url.searchParams.has('cursor') ? 'fixture' : null });
    if (path === `/admin/disputes/${id(77)}`) return ok(route, { id: id(77), transactionId: id(10), transactionTitle: 'Keyboard mekanik', assignedAdminId: id(2), status: 'IN_REVIEW', reason: 'Jadwal pengiriman perlu ditinjau.', version: 1, transaction: { ...tx(), status: 'DISPUTED' }, resolution: null, resolutionReason: null });
    if (path === `/admin/cases/${id(77)}/handover-access`) return ok(route, { grantId: id(78), expiresAt: new Date(Date.now() + (state.grantMs ?? 2000)).toISOString() });
    if (path === `/admin/cases/${id(77)}/handover` && url.searchParams.has('cursor') && state.adminPageFail) return route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Halaman admin gagal.' } } });
    if (path === `/admin/cases/${id(77)}/handover`) return ok(route, { coordination: coordination(), history: [plan('DELIVERY')], shipments: [], accessExpiresAt: new Date(Date.now() + (state.grantMs ?? 2000)).toISOString(), nextCursor: state.adminPaging && !url.searchParams.has('cursor') ? id(31) : null, shipmentNextCursor: null });
    if (path.endsWith('/handover') && req.method() === 'GET') return state.fail ? route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Koordinasi belum tersedia.' } } }) : ok(route, coordination());
    if (path.endsWith('/proposals/' + id(30))) return ok(route, state.agreed ?? state.pending ?? plan()); if (path.endsWith('/shipments') && req.method() === 'GET') {
      if (state.revisionPaging) { if (url.searchParams.has('cursor') && state.revisionFail) return route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Halaman revisi gagal.' } } }); return ok(route, [{ id: url.searchParams.has('cursor') ? id(41) : id(40), proposalId: id(30), itemId: id(20), senderId: id(2), courier: 'Kurir Riwayat', trackingNumber: 'HISTORY-001', revision: url.searchParams.has('cursor') ? 1 : 2, recordedAt: now(), purgedAt: null, reason: null }], { nextCursor: url.searchParams.has('cursor') ? null : id(41) }); }
      return ok(route, state.resi ? [state.resi] : [], { nextCursor: null });
    }
    if (path.includes('/handover/') && req.method() === 'POST') {
      const body = req.postDataJSON(); state.writes.push({ path, body, key: req.headers()['idempotency-key'] }); state.version++;
      if (path.endsWith('/proposals')) state.pending = { ...plan(body.method), status: 'PENDING', plannedAt: body.plannedAt, timeZone: body.timeZone, privateDetails: { location: body.location ?? null, note: body.note ?? null, responseReason: null, destinations: [] } };
      else if (path.endsWith('/respond')) { if (body.accept) state.agreed = { ...state.pending, status: 'APPROVED', privateDetails: { ...state.pending.privateDetails, destinations: body.destination ? [{ userId: id(state.actor), details: body.destination }] : [] } }; state.pending = null; }
      else if (path.includes('/shipments/')) state.resi = { id: id(40), proposalId: id(30), itemId: id(20), senderId: id(2), courier: body.courier, trackingNumber: body.trackingNumber, reason: body.reason ?? null, revision: state.resi ? 2 : 1, recordedAt: now(), purgedAt: null };
      else state.pending = null;
      if (state.recovery) return route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Respons hilang.' } } });
      return ok(route, { id: id(30), transactionId: id(10), version: state.version, status: 'RECORDED' });
    }
    return ok(route, []);
  }); return state;
}
async function fits(page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
async function capture(page, name, project, target) { const dir = resolve('.impeccable/review/handover'); await mkdir(dir, { recursive: true }); if (target) await target.screenshot({ path: resolve(dir, `${name}-${project}.png`), animations: 'disabled', style: ' .account-toolbar, .account-skip { visibility: hidden; }' }); else await page.screenshot({ path: resolve(dir, `${name}-${project}.png`), fullPage: false }); }

for (const actor of [2, 3]) {
  test(`participant ${actor} chooses form or direct chat with the correct counterpart`, async ({ page }) => {
    const state = await mock(page, { actor }); await page.goto(`/app/transaksi/${id(10)}`);
    const choices = page.getByRole('group', { name: 'Pilihan koordinasi serah terima', exact: true });
    const form = choices.getByRole('button', { name: 'Atur serah terima', exact: true });
    await expect(form).toBeVisible();
    const chat = choices.getByRole('link', { name: 'Langsung ke chat', exact: true });
    await expect(chat).toHaveAttribute('href', `/pesan/${id(88)}`);
    await expect(choices).toContainText(`Diskusikan serah terima dengan ${actor === 2 ? 'Bima' : 'Dara'}.`);
    await chat.click(); await expect(page).toHaveURL(new RegExp(`/app/transaksi/${id(10)}$`));
    await expect(page.getByRole('dialog', { name: 'Pesan', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: `Buka profil ${actor === 2 ? 'Bima' : 'Dara'}`, exact: true })).toHaveAttribute('href', `/profil/${id(actor === 2 ? 3 : 2)}`);
    await expect(page.locator('.chat-listing-title')).toHaveText('Keyboard mekanik');
    await expect(page.getByRole('dialog', { name: 'Pesan', exact: true })).toHaveCount(1);
    expect(state.writes).toHaveLength(0); expect(state.pending).toBeNull();
    expect(state.requests.some(request => request.method === 'POST' && request.path.endsWith('/messages'))).toBe(false);
    await page.getByRole('link', { name: 'Buka kesepakatan', exact: true }).click();
    await form.click(); await expect(page.getByRole('dialog', { name: 'Atur serah terima', exact: true })).toBeVisible();
    await page.keyboard.press('Escape'); await expect(form).toBeFocused();
  });
}

test('missing chat is explained while the handover form remains available', async ({ page }) => {
  await mock(page, { conversationId: null }); await page.goto(`/app/transaksi/${id(10)}`);
  const choices = page.getByRole('group', { name: 'Pilihan koordinasi serah terima', exact: true });
  await expect(choices.getByRole('button', { name: 'Langsung ke chat', exact: true })).toBeDisabled();
  await expect(choices).toContainText('Percakapan untuk transaksi ini belum tersedia.');
  await expect(choices.getByRole('link')).toHaveCount(0);
  await choices.getByRole('button', { name: 'Atur serah terima', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Atur serah terima', exact: true })).toBeVisible();
});

test('pending proposal keeps direct chat available without creating another proposal', async ({ page }) => {
  const state = await mock(page, { pending: { ...plan(), status: 'PENDING' } });
  await page.goto(`/app/transaksi/${id(10)}`);
  await expect(page.getByRole('button', { name: 'Atur serah terima', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Langsung ke chat', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Buka profil Bima', exact: true })).toHaveAttribute('href', `/profil/${id(3)}`);
  expect(state.writes).toHaveLength(0); expect(state.pending.status).toBe('PENDING'); expect(state.version).toBe(1);
});

test('coordination choices fit mobile and desktop with usable targets', async ({ page }, info) => {
  await mock(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(`/app/transaksi/${id(10)}`);
    const panel = page.getByRole('region', { name: 'Koordinasi serah terima', exact: true });
    const choices = panel.getByRole('group', { name: 'Pilihan koordinasi serah terima', exact: true });
    await expect(choices).toBeVisible();
    for (const control of await choices.locator('button, a').all()) {
      const rect = await control.boundingBox();
      expect(rect.height).toBeGreaterThanOrEqual(44); expect(rect.width).toBeGreaterThanOrEqual(44);
    }
    expect(await choices.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await fits(page);
    if (width === 390 || width === 1440) await capture(page, `coordination-choices-${width}`, info.project.name, panel);
  }
});

test('proposal has explicit timezone, native validation, private memory and centered dialog', async ({ page }, info) => {
  const state = await mock(page); await page.goto(`/app/transaksi/${id(10)}`); await page.getByRole('button', { name: 'Atur serah terima', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); await page.getByRole('radio', { name: 'WITA UTC+08', exact: true }).check(); await page.getByLabel('Tanggal dan waktu pertemuan').fill(meetingInput); await page.getByLabel('Lokasi pertemuan').fill('Perpustakaan Kota Kediri, lobi utama');
  const rect = await dialog.boundingBox(); expect(Math.abs(rect.x + rect.width / 2 - info.project.use.viewport.width / 2)).toBeLessThan(2); await fits(page); await capture(page, 'proposal', info.project.name);
  await page.getByRole('button', { name: 'Kirim usulan', exact: true }).click(); await expect(dialog).toHaveCount(0); expect(state.writes[0].body.plannedAt).toBe(new Date(Date.parse(meetingInput + ':00Z') - 8 * 3600000).toISOString()); expect(state.writes[0].key).toBeTruthy(); expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain('Perpustakaan'); await expect(page.getByText('Menunggu tanggapan', { exact: true })).toBeVisible();
});

test('horizontal timezone choices support keyboard and preserve the scheduled instant', async ({ page }) => {
  const state = await mock(page); await page.goto(`/app/transaksi/${id(10)}`);
  await page.getByRole('button', { name: 'Atur serah terima', exact: true }).click();
  const zones = page.getByRole('group', { name: 'Zona waktu', exact: true });
  await expect(zones.getByRole('radio')).toHaveCount(3);
  const wib = zones.getByRole('radio', { name: 'WIB UTC+07', exact: true });
  await wib.check(); await page.getByLabel('Tanggal dan waktu pertemuan').fill(meetingInput);
  await wib.focus(); await page.keyboard.press('ArrowRight');
  await expect(zones.getByRole('radio', { name: 'WITA UTC+08', exact: true })).toBeChecked();
  await expect(page.getByLabel('Tanggal dan waktu pertemuan')).toHaveValue(new Date(Date.parse(meetingInput + ':00Z') + 3600000).toISOString().slice(0, 16));
  await page.keyboard.press('ArrowRight');
  await expect(zones.getByRole('radio', { name: 'WIT UTC+09', exact: true })).toBeChecked();
  await expect(page.getByLabel('Tanggal dan waktu pertemuan')).toHaveValue(new Date(Date.parse(meetingInput + ':00Z') + 2 * 3600000).toISOString().slice(0, 16));
  await wib.check(); await expect(page.getByLabel('Tanggal dan waktu pertemuan')).toHaveValue(meetingInput);
  await page.getByRole('button', { name: 'Kirim usulan', exact: true }).click(); expect(state.writes).toHaveLength(0);
  await expect(page.getByLabel('Lokasi pertemuan')).toBeFocused();
  await page.getByLabel('Lokasi pertemuan').fill('Lobi perpustakaan, pintu utama');
  await page.getByRole('button', { name: 'Kirim usulan', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.writes[0].body).toMatchObject({ timeZone: 'Asia/Jakarta', plannedAt: new Date(Date.parse(meetingInput + ':00Z') - 7 * 3600000).toISOString() });
});

test('proposal follows device orientation with visible header and actions and retains drafts on rotation', async ({ page }, info) => {
  await mock(page); await page.goto(`/app/transaksi/${id(10)}`);
  const trigger = page.getByRole('button', { name: 'Atur serah terima', exact: true }); await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused();
  await page.getByLabel('Lokasi pertemuan').fill('Lobi perpustakaan, jangan hilangkan draft ini');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 844, height: 390 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 320, height: 720 }]) {
    await page.setViewportSize(viewport);
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(16); expect(box.y).toBeGreaterThanOrEqual(16);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 16);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 16);
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(box.width > box.height).toBe(viewport.width > viewport.height);
    for (const control of [dialog.getByRole('button', { name: 'Tutup dialog', exact: true }), dialog.getByRole('button', { name: 'Kirim usulan', exact: true })]) {
      const rect = await control.boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(box.y); expect(rect.y + rect.height).toBeLessThanOrEqual(box.y + box.height);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    }
    const radios = await dialog.getByRole('radio').all(); const choices = await Promise.all(radios.map(radio => radio.boundingBox()));
    expect(Math.max(...choices.map(rect => rect.y)) - Math.min(...choices.map(rect => rect.y))).toBeLessThan(1);
    choices.forEach(rect => { expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44); });
    await expect(page.getByLabel('Lokasi pertemuan')).toHaveValue('Lobi perpustakaan, jangan hilangkan draft ini');
    expect(await dialog.locator('.handover-dialog-body').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await fits(page); await capture(page, `proposal-${viewport.width}x${viewport.height}`, info.project.name);
  }
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
});

test('delivery proposal groups recipient details and validates before submitting', async ({ page }, info) => {
  const state = await mock(page, { actor: 3 }); await page.goto(`/app/transaksi/${id(10)}`);
  await page.getByRole('button', { name: 'Atur serah terima', exact: true }).click();
  await page.getByLabel('Metode serah terima').click(); await page.getByRole('option', { name: 'Pengiriman', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alamat dan catatan', exact: true })).toBeVisible();
  await expect(page.getByLabel('Lokasi pertemuan')).toHaveCount(0);
  await page.getByLabel('Perkiraan tanggal dan waktu diterima').fill(meetingInput);
  await page.getByRole('button', { name: 'Kirim usulan', exact: true }).click(); expect(state.writes).toHaveLength(0);
  await expect(page.getByLabel('Nama penerima', { exact: true })).toBeFocused();
  await page.getByLabel('Nama penerima', { exact: true }).fill('Bima');
  await page.getByLabel('Nomor telepon penerima').fill('081234567890');
  await page.getByLabel('Alamat lengkap').fill('Jalan Melati nomor 12, Kota Kediri');
  await capture(page, 'delivery-proposal', info.project.name);
  await page.getByRole('button', { name: 'Kirim usulan', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.writes[0].body.destination.recipientName).toBe('Bima'); expect(state.writes[0].body).not.toHaveProperty('location');
});
test('receiver approves delivery with own destination and compares existing plan', async ({ page }) => {
  const state = await mock(page, { actor: 3, agreed: plan(), pending: { ...plan('DELIVERY'), status: 'PENDING', privateDetails: { ...plan('DELIVERY').privateDetails, destinations: [] } } }); await page.goto(`/app/transaksi/${id(10)}`); await page.getByRole('button', { name: 'Tinjau usulan' }).click(); await expect(page.getByText('Bandingkan kesepakatan saat ini')).toBeVisible(); await page.getByLabel('Nama penerima', { exact: true }).fill('Bima'); await page.getByLabel('Nomor telepon penerima').fill('081234567890'); await page.getByLabel('Alamat lengkap').fill('Jalan Melati nomor 12, Kota Kediri'); await page.getByRole('button', { name: 'Setujui usulan', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); expect(state.writes[0].body.destination.recipientName).toBe('Bima'); await expect(page.getByText('Pengirim belum mencatat resi.')).toBeVisible();
});
test('sender records and corrects tracking, timeline and 320px fit', async ({ page }, info) => {
  const state = await mock(page, { agreed: plan('DELIVERY'), timelineMore: true }); await page.goto(`/app/transaksi/${id(10)}`); const panel = page.getByRole('region', { name: 'Koordinasi serah terima', exact: true }); await expect(panel.getByText('Jalan Melati nomor 12, Kota Kediri')).toBeVisible(); await capture(page, 'coordination', info.project.name, panel); await page.getByRole('button', { name: 'Catat resi', exact: true }).click(); await page.getByLabel('Kurir', { exact: true }).fill('Kurir Lokal'); await page.getByLabel('Nomor resi', { exact: true }).fill('VAL-001'); await page.getByRole('button', { name: 'Simpan resi', exact: true }).click(); await expect(panel.getByText('VAL-001', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Perbaiki resi' }).click(); await page.getByLabel('Alasan perbaikan resi').fill('Memperbaiki nomor pengiriman.'); await page.getByLabel('Nomor resi', { exact: true }).fill('VAL-002'); await page.getByRole('button', { name: 'Simpan resi', exact: true }).click(); expect(state.resi.revision).toBe(2); await page.getByRole('button', { name: 'Muat aktivitas sebelumnya' }).click(); await expect(page.getByText('Penawaran disepakati', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 760 }); await fits(page); await capture(page, 'narrow', info.project.name, panel); await page.getByRole('button', { name: 'Perbaiki resi' }).click(); await fits(page); await capture(page, 'narrow-form', info.project.name); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('response recovery preserves fields and blocks duplicate submission', async ({ page }) => {
  const state = await mock(page, { recovery: true }); await page.goto(`/app/transaksi/${id(10)}`); await page.getByRole('button', { name: 'Atur serah terima', exact: true }).click(); await page.getByLabel('Tanggal dan waktu pertemuan').fill(meetingInput); await page.getByLabel('Lokasi pertemuan').fill('Lobi perpustakaan kota'); await page.getByRole('button', { name: 'Kirim usulan', exact: true }).click(); await expect(page.getByLabel('Lokasi pertemuan')).toHaveValue('Lobi perpustakaan kota'); await expect(page.getByRole('button', { name: 'Kirim usulan', exact: true })).toBeDisabled(); await page.getByRole('button', { name: 'Periksa ulang tindakan' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); expect(state.writes).toHaveLength(1);
});
test('loading error retries and frozen coordination hides mutation controls', async ({ page }) => {
  const state = await mock(page, { fail: true }); await page.goto(`/app/transaksi/${id(10)}`); await expect(page.getByText('Koordinasi belum dapat dimuat.')).toBeVisible(); state.fail = false; state.locked = true; state.agreed = plan(); await page.getByRole('button', { name: 'Coba lagi', exact: true }).click(); await expect(page.getByText('Koordinasi dikunci setelah serah terima dimulai atau transaksi ditutup.')).toBeVisible(); await expect(page.getByRole('button', { name: 'Atur serah terima', exact: true })).toHaveCount(0);
});

test('admin grant expires and removes private coordination from view', async ({ page }, info) => {
  await mock(page, { admin: true, agreed: plan('DELIVERY') }); await page.goto(`/app/admin/sengketa/${id(77)}`); await page.getByLabel('Alasan akses koordinasi').fill('Memeriksa alamat pada kasus ini.'); await page.getByRole('button', { name: 'Buka koordinasi dengan audit' }).click(); await expect(page.getByText('Jalan Melati nomor 12, Kota Kediri').first()).toBeVisible(); await capture(page, 'admin', info.project.name, page.locator('.handover-panel')); await expect(page.getByText('Akses koordinasi berakhir. Isi alasan untuk membuka akses baru.')).toBeVisible({ timeout: 10000 }); await expect(page.getByText('Jalan Melati nomor 12, Kota Kediri')).toHaveCount(0);
});

test('stale form preserves draft and requires explicit version review', async ({ page }) => {
  await page.clock.install(); const state = await mock(page); await page.goto(`/app/transaksi/${id(10)}`); await page.getByRole('button', { name: 'Atur serah terima', exact: true }).click(); await page.getByLabel('Tanggal dan waktu pertemuan').fill(meetingInput); await page.getByLabel('Lokasi pertemuan').fill('Lobi untuk jadwal terbaru'); state.version = 4; await page.clock.fastForward(16000); await expect(page.getByRole('button', { name: 'Kirim usulan', exact: true })).toBeDisabled(); await expect(page.getByLabel('Lokasi pertemuan')).toHaveValue('Lobi untuk jadwal terbaru'); await page.getByRole('button', { name: 'Gunakan versi terbaru' }).click(); await page.getByRole('button', { name: 'Kirim usulan', exact: true }).click(); expect(state.writes[0].body.expectedVersion).toBe(4);
});

test('activity pagination failure retains rows and retries the failed page', async ({ page }, info) => {
  const state = await mock(page, { timelineMore: true, timelineFail: true }); await page.goto(`/app/transaksi/${id(10)}`); await page.getByRole('button', { name: 'Muat aktivitas sebelumnya' }).click(); await expect(page.getByText('Aktivitas sebelumnya belum dapat dimuat.')).toBeVisible(); await expect(page.getByText('Koordinasi serah terima disepakati', { exact: true })).toBeVisible(); await capture(page, 'pagination', info.project.name, page.locator('.handover-panel').last()); state.timelineFail = false; await page.getByRole('button', { name: 'Coba muat aktivitas lagi' }).click(); await expect(page.getByText('Penawaran disepakati', { exact: true })).toBeVisible();
});
test('revision pagination failure retains private revisions and retries that page', async ({ page }, info) => {
  const state = await mock(page, { agreed: plan('DELIVERY'), revisionPaging: true, revisionFail: true }); await page.goto(`/app/transaksi/${id(10)}`); await page.getByRole('button', { name: 'Lihat detail', exact: true }).click(); await expect(page.getByRole('dialog').getByText('Keyboard mekanik · revisi 2', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Muat revisi sebelumnya' }).click(); await expect(page.getByText('Revisi sebelumnya belum dapat dimuat.')).toBeVisible(); await expect(page.getByRole('dialog').getByText('Keyboard mekanik · revisi 2', { exact: true })).toBeVisible(); await capture(page, 'revision-error', info.project.name); state.revisionFail = false; await page.getByRole('button', { name: 'Coba muat revisi lagi' }).click(); await expect(page.getByRole('dialog').getByText('Keyboard mekanik · revisi 1', { exact: true })).toBeVisible();
});
test('admin paging failure retains agreement and already loaded proposals', async ({ page }, info) => {
  const state = await mock(page, { admin: true, agreed: plan('DELIVERY'), adminPaging: true, adminPageFail: true, grantMs: 300000 }); await page.goto(`/app/admin/sengketa/${id(77)}`); await page.getByLabel('Alasan akses koordinasi').fill('Memeriksa riwayat koordinasi kasus.'); await page.getByRole('button', { name: 'Buka koordinasi dengan audit' }).click(); await page.getByRole('button', { name: 'Muat usulan sebelumnya' }).click(); await expect(page.getByText('Usulan sebelumnya belum dapat dimuat.')).toBeVisible(); await expect(page.getByText('Jalan Melati nomor 12, Kota Kediri').first()).toBeVisible(); await expect(page.locator('.handover-comparison')).toHaveCount(1); await capture(page, 'admin-pagination', info.project.name, page.locator('.handover-panel')); state.adminPageFail = false; await page.getByRole('button', { name: 'Coba muat usulan lagi' }).click(); await expect(page.locator('.handover-comparison')).toHaveCount(2);
});
