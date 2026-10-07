import { test, expect } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import dotenv from "../../../api/node_modules/dotenv/lib/main.js";
import { PrismaPg } from "../../../api/node_modules/@prisma/adapter-pg/dist/index.mjs";
import { PrismaClient } from "../../../api/dist/generated/prisma/client.js";
import { check, credentials, login, createItem } from "../../../api/scripts/helpers/fixtures.mjs";
const local = dotenv.parse(await readFile(new URL("../../../api/.env.local", import.meta.url)));
if (!new URL(local.TEST_DATABASE_URL).pathname.endsWith('_test')) throw new Error('Stage 6 browser requires test database.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: local.TEST_DATABASE_URL }) });
const fakeId = '11111111-1111-4111-8111-111111111111';
async function inventory(root = resolve('src/app'), prefix = '') {
  const routes = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory()) routes.push(...await inventory(resolve(root, entry.name), prefix + '/' + entry.name));
    else if (entry.name === 'page.tsx') routes.push((prefix || '/').replace(/\[[^\]]+\]/g, fakeId));
  }
  return routes.sort();
}
async function actor(role = 'USER', verified = true) {
  const seed = await db.user.findUniqueOrThrow({ where: { email: 'owner.demo@valora.local' } });
  const user = await db.user.create({ data: { email: `browser6-${randomUUID()}@demo.valora.local`, displayName: 'Akun browser enam', role, cityId: seed.cityId, passwordHash: seed.passwordHash, emailVerifiedAt: verified ? new Date() : null } });
  return { user, account: await login(user.email) };
}
async function contextFor(browser, account, viewport) {
  const context = await browser.newContext({ viewport, baseURL: 'http://127.0.0.1:3002' });
  if (account) await context.addCookies(account.cookieHeader().split('; ').map((raw) => { const i = raw.indexOf('='); return { name: raw.slice(0, i), value: raw.slice(i + 1), domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }; }));
  return context;
}
async function logoutFrom(page) { const menu = page.getByRole('button', { name: /^(Buka menu|Buka navigasi akun)$/ }); if (await menu.isVisible()) await menu.click(); await page.getByRole('button', { name: 'Keluar', exact: true }).filter({ visible: true }).first().click(); }
async function fits(page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }

test('Matriks seluruh halaman: Guest, User, Admin, email belum terverifikasi dan koneksi sesi gagal', async ({ browser }, info) => {
  test.setTimeout(600000);
  const routes = await inventory(); expect(routes).toHaveLength(52); const records = [];
  const user = await actor(); const admin = await actor('ADMIN'); const unverified = await actor('USER', false); const expired = await actor(); const restricted = await actor();
  for (const [role, account] of [['Guest', null], ['User', user.account], ['Admin', admin.account], ['Unverified', unverified.account], ['Unavailable', user.account], ['Revoked', user.account], ['Expired', expired.account], ['Suspended', restricted.account], ['Closed', restricted.account]]) {
    if (role === 'Revoked') await db.session.updateMany({ where: { userId: user.user.id }, data: { revokedAt: new Date() } });
    if (role === 'Expired') await db.session.updateMany({ where: { userId: expired.user.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    if (role === 'Suspended' || role === 'Closed') await db.user.update({ where: { id: restricted.user.id }, data: { status: role === 'Closed' ? 'CLOSED' : 'SUSPENDED' } });
    const context = await contextFor(browser, account, info.project.use.viewport); const page = await context.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (role === 'Unavailable') await page.route('**/api/v1/auth/session', (route) => route.abort('failed'));
    try {
      for (const route of routes) {
        await page.goto(route); const privateRoute = route.startsWith('/app'); const adminRoute = route.startsWith('/app/admin');
        if (privateRoute && ['Guest', 'Revoked', 'Expired'].includes(role)) await expect(page).toHaveURL(/\/masuk\?next=/);
        else if (privateRoute && role === 'Unavailable') { await expect(page.getByText('Koneksi sesi belum tersedia.')).toBeVisible(); await expect(page.locator('.app-main, #account-main')).toHaveCount(0); }
        else if (privateRoute && ['Suspended', 'Closed'].includes(role)) { await expect(page.getByText('Akun ini tidak dapat digunakan.')).toBeVisible(); await expect(page.locator('.app-main, #account-main')).toHaveCount(0); }
        else if (adminRoute && ['User', 'Unverified'].includes(role)) { await expect(page.getByText('Halaman ini hanya untuk admin.')).toBeVisible(); await expect(page.locator('.app-main, #account-main')).toHaveCount(0); }
        else if (privateRoute) { await expect(page.locator('.app-main, #account-main')).toBeVisible(); if (role === 'Unverified') await expect(page.getByText('Alamat email belum diverifikasi.', { exact: false })).toBeVisible(); }
        else { await expect(page.locator('body')).not.toBeEmpty(); }
        const checks = ['direct'];
        if (['User', 'Admin'].includes(role)) {
          await page.reload();
          if (privateRoute && adminRoute && role === 'User') await expect(page.getByText('Halaman ini hanya untuk admin.')).toBeVisible();
          else if (privateRoute) await expect(page.locator('.app-main, #account-main')).toBeVisible();
          checks.push('refresh');
          if (privateRoute) {
            await page.goto('/cara-kerja'); await page.goBack();
            if (adminRoute && role === 'User') await expect(page.getByText('Halaman ini hanya untuk admin.')).toBeVisible(); else await expect(page.locator('.app-main, #account-main')).toBeVisible();
            await page.goForward(); await expect(page).toHaveURL(/\/cara-kerja$/);
            checks.push('back-forward');
          }
        }
        await fits(page); records.push({ route, role, checks, result: 'PASS' });
      }
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  }
  const directory = resolve('../../.local/stage6-evidence'); await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'routes-' + info.project.name + '.json'), JSON.stringify(records, null, 2));
});

test('Sesi antartab, login next, offline logout, respons lama, refresh dan history', async ({ browser }, info) => {
  const a = await actor(); const b = await actor(); const context = await contextFor(browser, a.account, info.project.use.viewport);
  const first = await context.newPage(); const second = await context.newPage();
  try {
    await first.goto('/app/profil'); await expect(first.getByRole('heading', { name: 'Sesi aktif' })).toBeVisible();
    await second.goto('/app'); await expect(second.locator('.app-main, #account-main')).toBeVisible();
    await logoutFrom(first);
    await expect(first).toHaveURL(/\/masuk/); await expect(second).toHaveURL(/\/masuk/); await expect(second.locator('.app-main, #account-main')).toHaveCount(0);
    await first.getByLabel('Email', { exact: true }).fill(b.user.email); await first.getByLabel('Kata sandi', { exact: true }).fill(credentials.password); await first.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(first).toHaveURL(/\/app\/profil/); await expect(second.getByText('Kamu sudah masuk.', { exact: false })).toBeVisible();
    await first.reload(); await expect(first.getByRole('heading', { name: 'Profil saya' })).toBeVisible();
    await first.goto('/app/barang'); await expect(first.locator('.app-main, #account-main')).toBeVisible(); await first.goBack(); await expect(first.getByRole('heading', { name: 'Profil saya' })).toBeVisible(); await first.goForward(); await expect(first.locator('.app-main, #account-main')).toBeVisible();
    await first.route('**/api/v1/auth/logout', (route) => route.abort('failed'));
    await logoutFrom(first); await expect(first.getByText('Permintaan keluar belum terkonfirmasi.', { exact: false })).toBeVisible(); await expect(first.locator('.app-main, #account-main')).toHaveCount(0);
    await expect(first.getByRole('button', { name: 'Coba keluar lagi' })).toBeEnabled(); await first.unroute('**/api/v1/auth/logout'); await first.getByRole('button', { name: 'Coba keluar lagi' }).click(); await expect(first).toHaveURL(/\/masuk/);
    await first.goto('/masuk?next=https://evil.example'); await first.getByLabel('Email', { exact: true }).fill(a.user.email); await first.getByLabel('Kata sandi', { exact: true }).fill(credentials.password); await first.getByRole('button', { name: 'Masuk', exact: true }).click(); await expect(first).toHaveURL(/\/app$/);
    await first.goto('/app/profil'); await fits(first); await mkdir(resolve('../../.local/stage6-evidence'), { recursive: true }); await first.screenshot({ path: '../../.local/stage6-evidence/sessions-' + info.project.name + '.png', fullPage: true });
  } finally { await context.close(); }
});

test('Pencabutan, expiry tujuh hari dan reautentikasi 15 menit pada profil', async ({ browser }, info) => {
  test.setTimeout(240000);
  const a = await actor(); const context = await contextFor(browser, a.account, info.project.use.viewport); const page = await context.newPage();
  try {
    const meta = check(await a.account.request('/auth/session'), 200, 'Session fixture');
    await db.session.update({ where: { id: meta.sessionId }, data: { reauthenticatedAt: new Date(Date.now() - 900001) } });
    await page.goto('/app/profil'); await expect(page.getByRole('heading', { name: 'Profil saya' })).toBeVisible();
    await page.getByRole('button', { name: 'Cabut semua sesi lain' }).click(); const confirm = page.getByRole('dialog'); await confirm.getByRole('checkbox').check(); await confirm.getByRole('button', { name: 'Cabut sesi', exact: true }).click();
    const reauth = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Verifikasi kata sandi' }) }); await expect(reauth).toBeVisible();
    await reauth.getByLabel('Kata sandi saat ini').fill('incorrect'); await reauth.getByRole('button', { name: 'Verifikasi', exact: true }).click(); await expect(reauth.getByText('Kata sandi salah.')).toBeVisible(); await expect(page.locator('.app-main, #account-main')).toBeVisible();
    await reauth.getByLabel('Kata sandi saat ini').fill(credentials.password); await reauth.getByRole('button', { name: 'Verifikasi', exact: true }).click(); await expect(reauth).not.toBeVisible(); await confirm.getByRole('button', { name: 'Cabut sesi', exact: true }).click(); await expect(confirm).not.toBeVisible();
    await db.session.update({ where: { id: meta.sessionId }, data: { revokedAt: new Date() } });
    await page.evaluate(() => window.dispatchEvent(new Event('online'))); await expect(page).toHaveURL(/\/masuk/); await expect(page.locator('.app-main, #account-main')).toHaveCount(0);
    const expired = await actor(); const expiredContext = await contextFor(browser, expired.account, info.project.use.viewport); const expiredPage = await expiredContext.newPage();
    try { const expiredMeta = check(await expired.account.request('/auth/session'), 200, 'Expiry fixture'); await db.session.update({ where: { id: expiredMeta.sessionId }, data: { expiresAt: new Date(Date.now() - 1) } }); for (const route of (await inventory()).filter((r) => r.startsWith('/app'))) { await expiredPage.goto(route); await expect(expiredPage).toHaveURL(/\/masuk\?next=/); } } finally { await expiredContext.close(); }
  } finally { await context.close(); }
});

test('Verifikasi email dan reset password memperbarui sesi antartab', async ({ browser }, info) => {
  const a = await actor('USER', false); const context = await contextFor(browser, a.account, info.project.use.viewport);
  const first = await context.newPage(); const second = await context.newPage();
  const tokenFor = async (purpose) => { const raw = randomUUID() + randomUUID(); await db.verificationToken.create({ data: { userId: a.user.id, purpose, tokenHash: createHash('sha256').update(raw).digest('hex'), expiresAt: new Date(Date.now() + 600000) } }); return raw; };
  try {
    await second.goto('/app/profil'); await expect(second.getByText('Alamat email belum diverifikasi.', { exact: false })).toBeVisible();
    await first.goto('/verifikasi-email?token=' + await tokenFor('EMAIL_VERIFY')); await first.getByRole('button', { name: 'Verifikasi email', exact: true }).click();
    await expect(first.getByText('Email berhasil diverifikasi.', { exact: false })).toBeVisible(); await expect(second.getByText('Alamat email belum diverifikasi.', { exact: false })).toHaveCount(0); await expect(second.locator('.app-main, #account-main')).toBeVisible();
    await first.goto('/reset-password?token=' + await tokenFor('PASSWORD_RESET')); await first.getByLabel('Kata sandi baru', { exact: true }).fill('Stage6-browser-new-password'); await first.getByLabel('Ulangi kata sandi', { exact: true }).fill('Stage6-browser-new-password'); await first.getByRole('button', { name: 'Simpan kata sandi', exact: true }).click();
    await expect(first).toHaveURL(/\/masuk\?reset=success$/); await expect(first.getByText('Kata sandi diperbarui.', { exact: false })).toBeVisible(); await expect(second).toHaveURL(/\/masuk/); await expect(second.locator('.app-main, #account-main')).toHaveCount(0);
    expect(await db.session.count({ where: { userId: a.user.id, revokedAt: null } })).toBe(0);
  } finally { await context.close(); }
});

test('Akses bukti dibersihkan ketika grant lima menit berakhir', async ({ browser }, info) => {
  const admin = await actor('ADMIN'); const reporter = await actor();
  const report = await db.report.create({ data: { reporterId: reporter.user.id, targetType: 'USER', targetId: reporter.user.id, reasonCode: 'STAGE6_GRANT', details: 'Bukti privat harus hilang setelah grant', assignedAdminId: admin.user.id, status: 'IN_REVIEW' } });
  const context = await contextFor(browser, admin.account, info.project.use.viewport); const page = await context.newPage();
  try {
    await page.clock.install({ time: new Date() });
    await page.goto('/app/admin/laporan/' + report.id); await page.getByLabel('Alasan tindakan').fill('Membaca bukti sintetis untuk menguji batas waktu akses.');
    await page.getByRole('button', { name: 'Buka isi laporan', exact: true }).click(); const dialog = page.getByRole('dialog'); await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Simpan tindakan', exact: true }).click();
    await expect(page.getByText('Bukti privat harus hilang setelah grant')).toBeVisible();
    await page.clock.fastForward(310000); await expect(page.getByText('Bukti privat harus hilang setelah grant')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Buka isi laporan', exact: true })).toBeVisible(); await expect(page.locator('.app-main, #account-main')).toBeVisible();
  } finally { await context.close(); }
});

test('Respons privat akun lama diabaikan setelah logout dan pergantian identitas', async ({ browser }, info) => {
  const a = await actor(); const b = await actor(); const title = 'Rahasia akun lama ' + randomUUID(); await createItem(a.account, 'electronics', title);
  const context = await contextFor(browser, a.account, info.project.use.viewport); const page = await context.newPage();
  let release; let captured; const waiting = new Promise((r) => { release = r; }); const started = new Promise((r) => { captured = r; }); let held = false;
  await page.route('**/api/v1/items?**', async (route) => {
    if (held) return route.continue(); held = true;
    const response = await route.fetch(); captured(); await waiting;
    try { await route.fulfill({ response }); } catch { /* Logout cancels the old browser request. */ }
  });
  try {
    await page.goto('/app/barang'); await started; await expect(page.locator('.app-main, #account-main')).toBeVisible();
    await logoutFrom(page); await expect(page).toHaveURL(/\/masuk/);
    await page.getByLabel('Email', { exact: true }).fill(b.user.email); await page.getByLabel('Kata sandi', { exact: true }).fill(credentials.password); await page.getByRole('button', { name: 'Masuk', exact: true }).click(); await expect(page).toHaveURL(/\/app\/barang/);
    release(); await expect(page.getByText('Belum ada barang', { exact: false })).toBeVisible(); await expect(page.getByText(title)).toHaveCount(0);
  } finally { release(); await context.close(); }
});

test.afterAll(async () => { await db.$disconnect(); });
