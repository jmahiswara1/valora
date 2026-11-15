import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const id = value => `40000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const now = () => new Date().toISOString();
const user = actor => ({ id: id(actor), displayName: actor === 2 ? 'Dara' : 'Bima', email: 'payment@valora.local', role: 'USER', status: 'ACTIVE', emailVerifiedAt: now(), version: 1, city: { id: id(8), name: 'Kota Kediri', provinceName: 'Jawa Timur', code: '3571' }, profilePhotoUrl: null });
async function mock(page, options = {}) {
  const state = { actor: 3, type: 'RESELL', amount: 275000, payer: 'BIDDER', cash: false, version: 1, paid: false, failed: false, lost: false, blocked: null, writes: [], requests: [], ...options };
  const transaction = () => ({ id: id(10), listingId: id(11), offerId: id(12), type: state.type, status: 'AWAITING_HANDOVER', sellerOrDonorId: id(2), buyerOrRecipientId: id(3), finalPriceIdr: state.type === 'RESELL' ? state.amount : null, snapshot: { parties: [user(2), user(3)], items: [{ id: id(20), title: 'Keyboard mekanik', description: 'Keyboard dirawat dan siap digunakan kembali.', conditionSummary: 'Bekas pakai ringan.', mediaIds: [], fromUserId: id(2), toUserId: id(3) }], handoverMethods: ['MEETUP'], cashAdjustment: state.cash ? { payer: state.payer, amountIdr: state.amount } : null }, acceptedAt: now(), targetHandoverAt: new Date(Date.now() + 14 * 86400000).toISOString(), overdueAt: null, completedAt: null, correctedAt: null, cancelledAt: null, resolutionOrigin: null, version: state.version, confirmations: [], cashConfirmations: [], requiredConfirmations: [], cancellations: [], disputes: [], corrections: [], conversationId: null });
  const payment = () => { const needed = state.type === 'RESELL' || state.cash, payerId = state.type === 'EXCHANGE' && state.payer === 'OWNER' ? id(2) : id(3); return { transactionId: id(10), mode: 'DEMO', method: 'QRIS', status: state.paid ? 'PAID' : needed ? 'UNPAID' : 'NOT_REQUIRED', amountIdr: needed ? state.amount : 0, payerId, receiverId: payerId === id(2) ? id(3) : id(2), paidAt: state.paid ? now() : null, reference: state.paid ? id(99) : null, version: state.version, canSimulate: needed && !state.paid && !state.blocked && id(state.actor) === payerId, reason: state.blocked }; };
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname.slice(7); state.requests.push({ path, method: req.method() });
    const ok = (data, meta) => route.fulfill({ json: { data, ...(meta ? { meta } : {}) } });
    if (path === '/auth/session') return ok({ state: 'AUTHENTICATED', user: user(state.actor), sessionId: id(98), serverTime: now(), expiresAt: new Date(Date.now() + 86400000).toISOString(), reason: null });
    if (path === '/me') return ok(user(state.actor)); if (path === '/auth/csrf') return ok({ token: 'payment-fixture' });
    if (path === '/me/notifications/summary') return ok({ unreadCount: 0, recent: [] });
    if (path === '/transactions/' + id(10)) return ok(transaction());
    if (path.endsWith('/demo-payment')) return state.failed ? route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Pembayaran demo belum tersedia.' } } }) : ok(payment());
    if (path.endsWith('/demo-payment/confirm')) {
      state.writes.push({ body: req.postDataJSON(), key: req.headers()['idempotency-key'] }); state.paid = true; state.version++;
      return state.lost ? route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Respons hilang.' } } }) : ok(payment());
    }
    if (path === '/me/actions/status') return ok({ status: 'COMMITTED', completedAt: now() });
    if (path.endsWith('/handover')) return ok({ transactionId: id(10), version: state.version, serverTime: now(), deadlineAt: transaction().targetHandoverAt, pending: null, agreed: null, directions: [], permissions: { canPropose: true, canRespond: false, canWithdraw: false, reason: null } });
    return ok([], { nextCursor: null });
  });
  return state;
}
async function capture(page, name, project) { const dir = 'apps/web/.impeccable/review/payments'; await mkdir(dir, { recursive: true }); await page.screenshot({ path: `${dir}/${name}-${project}.png`, fullPage: false }); }

test('QRIS demo shows the entire supplied image and persists one simulated payment', async ({ page }, info) => {
  const state = await mock(page), errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/app/transaksi/' + id(10)); const panel = page.getByRole('region', { name: 'Pembayaran QRIS demo' });
  // section is named but has no explicit role in every browser implementation.
  await expect(page.locator('.payment-panel')).toContainText('Rp 275.000');
  await capture(page, 'unpaid', info.project.name); await page.getByRole('button', { name: 'Bayar dengan QRIS', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pembayaran QRIS demo', exact: true });
  await expect(dialog).toContainText('Jangan melakukan transfer sungguhan');
  const image = dialog.getByRole('img', { name: 'Gambar QRIS demo Valora lengkap' });
  await expect(image).toHaveJSProperty('naturalWidth', 1200); await expect(image).toHaveJSProperty('naturalHeight', 1700);
  const dimensions = await image.boundingBox(); expect(Math.abs(dimensions.width / dimensions.height - 1200 / 1700)).toBeLessThan(0.01);
  await expect(dialog.getByRole('link', { name: 'Unduh gambar QRIS utuh' })).toHaveAttribute('download', 'QRIS-demo-Valora.jpg');
  await expect(dialog.getByRole('combobox')).toHaveCount(0);
  const confirm = dialog.getByRole('button', { name: 'Simulasikan pembayaran berhasil', exact: true }); await expect(confirm).toBeDisabled();
  await capture(page, 'qris', info.project.name); await dialog.getByRole('checkbox').check(); await confirm.dblclick();
  await expect(dialog).not.toBeVisible(); await expect(page.locator('.payment-status')).toHaveText('Simulasi berhasil');
  expect(state.writes).toHaveLength(1); expect(state.writes[0].body).toEqual({ expectedVersion: 1, demoOnly: true }); expect(state.writes[0].key).toBeTruthy();
  await page.reload(); await expect(page.locator('.payment-panel')).toContainText('Simulasi berhasil'); await expect(page.getByRole('button', { name: 'Bayar dengan QRIS', exact: true })).toHaveCount(0);
  await capture(page, 'paid', info.project.name); expect(errors).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await expect(panel).toHaveCount(1);
});

test('seller can inspect QRIS but only the payer can simulate', async ({ page }) => {
  await mock(page, { actor: 2 }); await page.goto('/app/transaksi/' + id(10)); await expect(page.locator('.payment-panel')).toContainText('Menunggu Bima');
  await expect(page.getByRole('button', { name: 'Bayar dengan QRIS', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Lihat QRIS demo', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Pembayaran QRIS demo' });
  await expect(dialog.getByRole('button', { name: 'Simulasikan pembayaran berhasil', exact: true })).toHaveCount(0); await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(page.getByRole('button', { name: 'Lihat QRIS demo', exact: true })).toBeFocused();
});

for (const type of ['DONATE', 'EXCHANGE']) test(type + ' without money has no payment step', async ({ page }) => {
  const state = await mock(page, { type }); await page.goto('/app/transaksi/' + id(10)); await expect(page.getByRole('heading', { name: 'Koordinasi serah terima', exact: true })).toBeVisible();
  await expect(page.locator('.payment-panel')).toHaveCount(0); expect(state.requests.some(request => request.path.endsWith('/demo-payment'))).toBe(false);
});

test('exchange cash uses the agreed payer and amount', async ({ page }) => {
  await mock(page, { type: 'EXCHANGE', cash: true, payer: 'OWNER', amount: 50000, actor: 2 }); await page.goto('/app/transaksi/' + id(10));
  await expect(page.locator('.payment-panel')).toContainText('Pembayaran tambahan uang'); await expect(page.locator('.payment-panel')).toContainText('Rp 50.000'); await expect(page.locator('.payment-panel')).toContainText('Dara kepada Bima');
  await expect(page.getByRole('button', { name: 'Bayar dengan QRIS', exact: true })).toBeEnabled();
});

test('payment query retries and an uncertain simulation recovers without a second payment', async ({ page }) => {
  const state = await mock(page, { failed: true, lost: true }); await page.goto('/app/transaksi/' + id(10)); await expect(page.locator('.payment-panel')).toContainText('Status pembayaran demo belum dapat dimuat.');
  state.failed = false; await page.locator('.payment-panel').getByRole('button', { name: 'Coba lagi', exact: true }).click(); await page.getByRole('button', { name: 'Bayar dengan QRIS', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pembayaran QRIS demo' }); await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Simulasikan pembayaran berhasil', exact: true }).click();
  await expect(dialog).toContainText('Hasil tindakan belum dapat dipastikan.'); await expect(dialog.getByRole('button', { name: 'Simulasikan pembayaran berhasil', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Periksa ulang tindakan', exact: true }).click(); await expect(dialog).not.toBeVisible(); await expect(page.locator('.payment-status')).toHaveText('Simulasi berhasil'); expect(state.writes).toHaveLength(1);
});

test('stale payment review cannot silently confirm a newer transaction version', async ({ page }) => {
  await page.clock.install(); const state = await mock(page); await page.goto('/app/transaksi/' + id(10)); await page.getByRole('button', { name: 'Bayar dengan QRIS', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pembayaran QRIS demo' }); await dialog.getByRole('checkbox').check(); state.version = 3; await page.clock.fastForward(11000);
  await expect(dialog).toContainText('Data transaksi berubah.'); await expect(dialog.getByRole('button', { name: 'Simulasikan pembayaran berhasil', exact: true })).toBeDisabled(); expect(state.writes).toHaveLength(0);
});
