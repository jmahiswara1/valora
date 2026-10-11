import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = () => new Date().toISOString(), future = () => new Date(Date.now() + 86400000).toISOString();
const user = { id: id(1), displayName: 'Dara', email: 'fixture@valora.local', role: 'USER', status: 'ACTIVE', emailVerified: true, emailVerifiedAt: now(), version: 1, profilePhotoUrl: null, city: { id: id(9), name: 'Kota Kediri', province: 'Jawa Timur' } };
const actions = ['REPAIR', 'RESELL', 'EXCHANGE', 'DONATE'];
const assessment = historical => ({ id: id(20), itemId: id(10), itemRevision: 1, rubricVersionId: id(30), ruleVersion: 'score-v1', policyVersion: 'policy-v1', recommendationVersion: 'recommendation-v1', status: 'COMPLETE', score: 72, label: 'High Circular Potential', condition: 75, repairability: 63, economicValue: 75, reusePotential: 75, repairabilityReason: null, recommendations: actions.map(action => ({ action, status: 'ELIGIBLE', reasons: ['THRESHOLD_MET'] })), missingFields: [], safetyFlags: [], answers: null, economicSources: null, isCurrent: !historical, createdAt: now(), origin: 'USER_REPORTED', rubric: { id: id(30), ruleVersion: 'score-v1', safetyQuestions: [] } });
const explanation = state => ({ source: state.source, templateVersion: 'assessment-template-v1', promptVersion: 'assessment-ai-v1', assessmentId: id(20), historical: !!state.historical, summary: 'Komponen yang dilaporkan mendukung pemakaian ulang. Periksa kondisi fisik sebelum mengambil keputusan.', strengths: ['Kondisi dan potensi pakai ulang mendukung pertimbangan berikutnya.'], limitations: ['Data berasal dari laporan pengguna dan belum diperiksa secara fisik.'], actions: actions.map(action => ({ action, status: state.partial && action === 'RESELL' ? 'NEEDS_DATA' : 'ELIGIBLE', reasons: ['Keputusan mengikuti komponen dan rubrik yang tersimpan.'] })), nextSteps: ['Ungkapkan kendala kepada calon penerima sebelum serah terima.'], cached: !!state.cached, generatedAt: now(), expiresAt: state.expired ? new Date(0).toISOString() : future(), fallbackReason: state.reason ?? null, retryAt: state.retryAt ?? null });
async function mock(page, options = {}) {
  const state = { source: 'AI', calls: 0, delay: 0, failure: null, guest: false, ...options };
  const ok = (route, data) => route.fulfill({ json: { data } });
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname.slice(7);
    if (path === '/auth/session') return ok(route, { state: state.guest ? 'GUEST' : 'AUTHENTICATED', user: state.guest ? null : user, sessionId: state.guest ? null : id(99), serverTime: now(), expiresAt: future(), reauthenticatedUntil: future(), reason: null });
    if (path === '/me') return ok(route, user);
    if (path === '/auth/csrf') return ok(route, { token: 'explanation-fixture-csrf' });
    if (path === '/me/notifications/summary') return ok(route, { unreadCount: 0, recent: [] });
    if (path === `/assessments/${id(20)}`) { const a = assessment(state.historical); if (state.partial) Object.assign(a, { score: null, label: null, economicValue: null, status: 'PARTIAL_ECONOMIC', missingFields: ['estimatedResaleValue'], recommendations: a.recommendations.map(r => r.action === 'RESELL' ? { ...r, status: 'NEEDS_DATA', reasons: ['estimatedResaleValue'] } : r) }); return ok(route, a); }
    if (path.endsWith('/explain')) {
      state.calls++; expect(req.method()).toBe('POST'); expect(req.headers()['x-csrf-token']).toBe('explanation-fixture-csrf');
      if (state.delay) await new Promise(done => setTimeout(done, state.delay));
      if (state.failure) return route.fulfill({ status: state.failure, json: { error: { code: state.failure === 404 ? 'NOT_FOUND' : state.failure === 409 ? 'STATE_CONFLICT' : 'DEPENDENCY_UNAVAILABLE', message: state.failure === 409 ? 'Penilaian berubah. Muat ulang hasil penilaian.' : 'Penjelasan tidak dapat dimuat.' } } });
      return ok(route, explanation(state));
    }
    return ok(route, []);
  });
  await page.goto(`/app/barang/${id(10)}/penilaian/${id(20)}`);
  await expect(page.getByRole('heading', { name: 'Memahami hasil penilaian' })).toBeVisible();
  return state;
}
const section = page => page.locator('.explanation-section');
const generate = page => page.getByRole('button', { name: 'Jelaskan hasil penilaian', exact: true }).click();
const fits = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
test('manual generation, four action reasons, cached source and no automatic refetch', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const state = await mock(page, { cached: true }); expect(state.calls).toBe(0); await generate(page);
  await expect(section(page).getByText('Penjelasan AI', { exact: true })).toBeVisible(); await expect(section(page).getByText('Hasil tersimpan')).toBeVisible();
  await section(page).locator('.explanation-details > summary').click();
  for (const action of ['Repair', 'Resell', 'Exchange', 'Donate']) await expect(section(page).locator('dt').filter({ hasText: action })).toBeVisible();
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online')); }); await page.waitForTimeout(350); expect(state.calls).toBe(1); await fits(page);
  await mkdir('.impeccable/review/explainer', { recursive: true }); await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `.impeccable/review/explainer/${info.project.name}.png`, fullPage: true }); expect(errors).toEqual([]);
});
test('loading lasts beyond the shared default timeout and does not duplicate a click', async ({ page }) => {
  const state = await mock(page, { delay: 16000 }); await generate(page);
  await expect(section(page).getByRole('status')).toContainText('hingga satu menit'); await expect(section(page).getByRole('button')).toBeDisabled();
  await expect(section(page).getByText('Penjelasan AI', { exact: true })).toBeVisible({ timeout: 22000 }); expect(state.calls).toBe(1);
});
test('fallback keeps rule explanations and enforces cooldown before retry', async ({ page }) => {
  const state = await mock(page, { source: 'TEMPLATE', reason: 'TIMEOUT', retryAt: new Date(Date.now() + 3000).toISOString() }); await generate(page);
  await expect(section(page).getByText('Penjelasan dari rubrik', { exact: true })).toBeVisible(); await expect(section(page).getByRole('button', { name: 'Coba lagi setelah jeda' })).toBeDisabled();
  const retry = section(page).getByRole('button', { name: 'Coba penjelasan AI lagi' }); await expect(retry).toBeEnabled({ timeout: 5000 });
  Object.assign(state, { source: 'AI', reason: null, retryAt: null }); await retry.click(); await expect(section(page).getByText('Penjelasan AI', { exact: true })).toBeVisible(); expect(state.calls).toBe(2);
});
test('daily quota displays WIB reset and prevents retry', async ({ page }) => {
  const state = await mock(page, { source: 'TEMPLATE', reason: 'USER_QUOTA', retryAt: future() }); await generate(page);
  await expect(section(page)).toContainText('Batas penjelasan AI harianmu'); await expect(section(page)).toContainText('WIB'); await expect(section(page).getByRole('button', { name: 'Coba lagi setelah jeda' })).toBeDisabled(); expect(state.calls).toBe(1);
});
test('temporary errors preserve prior output but access loss clears it', async ({ page }) => {
  const state = await mock(page, { expired: true }); await generate(page);
  state.failure = 503; await section(page).getByRole('button', { name: 'Perbarui penjelasan' }).click(); await expect(section(page).getByRole('alert')).toContainText('Hasil sebelumnya tetap tersedia');
  await expect(section(page).getByText('Penjelasan AI', { exact: true })).toBeVisible();
  state.failure = 404; await section(page).getByRole('button', { name: 'Perbarui penjelasan' }).click(); await expect(section(page).getByText('Penjelasan AI', { exact: true })).toHaveCount(0); await expect(section(page).locator('.explanation-actions')).toHaveCount(0);
});
test('changed assessment requests reload and hides outdated explanation', async ({ page }) => {
  const state = await mock(page, { expired: true }); await generate(page); state.failure = 409;
  await section(page).getByRole('button', { name: 'Perbarui penjelasan' }).click(); await expect(section(page).getByRole('button', { name: 'Muat ulang penilaian' })).toBeVisible(); await expect(section(page).getByText('Penjelasan AI', { exact: true })).toHaveCount(0);
});
test('historical partial assessment and 320px layout preserve readable reasons', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 760 }); await mock(page, { source: 'TEMPLATE', reason: 'NOT_CONFIGURED', historical: true, partial: true }); await generate(page);
  await section(page).locator('.explanation-details > summary').click();
  await expect(section(page)).toContainText('Penilaian ini historis'); await expect(section(page).locator('dt').filter({ hasText: 'Resell' })).toContainText('Perlu data');
  await expect(section(page).locator('button')).toHaveCount(0); await fits(page);
  if (info.project.name === 'mobile') { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: '.impeccable/review/explainer/narrow.png', fullPage: true }); }
});
test('plain text output never executes markup', async ({ page }) => {
  const state = await mock(page); await page.route(`**/api/v1/assessments/${id(20)}/explain`, route => route.fulfill({ json: { data: { ...explanation(state), summary: '<img src=x onerror="alert(1)"> Hasil sintetis.' } } }));
  await generate(page); await expect(section(page)).toContainText('<img src=x'); await expect(section(page).locator('img')).toHaveCount(0);
});
