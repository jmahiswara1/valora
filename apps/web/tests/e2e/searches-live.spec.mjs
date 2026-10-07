import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { login, createItem, createListing, approve, credentials, check } from '../../../api/scripts/helpers/fixtures.mjs';

const require = createRequire(resolve('../api/package.json'));
const { PrismaPg } = require('@prisma/adapter-pg'), dotenv = require('dotenv');
const { PrismaClient } = await import(pathToFileURL(resolve('../api/dist/generated/prisma/client.js')).href);
const config = dotenv.parse(await readFile(resolve('../api/.env.local')));
if (!config.TEST_DATABASE_URL || !new URL(config.TEST_DATABASE_URL).pathname.endsWith('_test')) throw new Error('Live browser checks require a test database.');

test('real saved search receives first-publication notification through background worker', async ({ page }) => {
  test.setTimeout(160000);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.TEST_DATABASE_URL }) });
  const accounts = [];
  try {
    const seed = await db.user.findUniqueOrThrow({ where: { email: 'owner.demo@valora.local' } });
    async function actor(role = 'USER', verified = true) {
      const user = await db.user.create({ data: { email: `search-browser-${randomUUID()}@demo.valora.local`, displayName: 'Pencarian Browser', cityId: seed.cityId, passwordHash: seed.passwordHash, role, emailVerifiedAt: verified ? new Date() : null } });
      return user;
    }
    const reader = await actor('USER', false), owner = await actor(), admin = await actor('ADMIN');
    const ownerAccount = await login(owner.email), adminAccount = await login(admin.email); accounts.push(ownerAccount, adminAccount);
    const q = `Perangkat ${randomUUID().slice(0,8)}`;
    await page.goto('/masuk?next=' + encodeURIComponent(`/market?q=${encodeURIComponent(q)}&category=electronics&type=RESELL`));
    await page.getByLabel('Email', { exact: true }).fill(reader.email); await page.getByLabel('Kata sandi', { exact: true }).fill(credentials.password); await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.locator('#market-q')).toHaveValue(q); await page.getByRole('button', { name: 'Simpan pencarian', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Nama pencarian').fill('Pantau perangkat'); await page.getByRole('dialog').getByRole('button', { name: 'Simpan pencarian', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await db.savedSearch.count({ where: { userId: reader.id } })).toBe(1);
    const { item, assessment } = await createItem(ownerAccount, 'electronics', q);
    const listing = await approve(adminAccount, await createListing(ownerAccount, item, assessment, seed.cityId, 'RESELL', q));
    await page.goto('/app/notifikasi'); await page.getByRole('button', { name: 'Market', exact: true }).click();
    const notification = page.getByRole('link', { name: new RegExp('Barang baru yang cocok.*' + q) });
    await expect(notification).toBeVisible({ timeout: 100000 }); await notification.click();
    await expect(page).toHaveURL(new RegExp('/market/' + listing.id)); await expect(page.getByRole('heading', { name: q, exact: true })).toBeVisible();
    await expect.poll(async () => Boolean((await db.inAppNotification.findFirst({ where: { userId: reader.id, type: 'SAVED_SEARCH_MATCH' } }))?.readAt)).toBeTruthy();
    expect(await db.inAppNotification.count({ where: { userId: reader.id, type: 'SAVED_SEARCH_MATCH' } })).toBe(1);
    const csrf = await (await page.request.get('/api/v1/auth/csrf')).json();
    const close = await page.request.post('/api/v1/me/close', { headers: { 'X-CSRF-Token': csrf.data.token }, data: {} }); expect(close.status()).toBe(201);
    expect(await db.savedSearch.count({ where: { userId: reader.id } })).toBe(0);
  } finally {
    for (const account of accounts) check(await account.request('/me/close', { method: 'POST', body: {} }), 201, 'Close live browser fixture');
    await db.$disconnect();
  }
});
