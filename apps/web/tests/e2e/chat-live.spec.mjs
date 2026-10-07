import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { login, createItem, createListing, approve } from '../../../api/scripts/helpers/fixtures.mjs';
const require = createRequire(resolve('../api/package.json'));
const { PrismaPg } = require('@prisma/adapter-pg'), dotenv = require('dotenv');
const { PrismaClient } = await import(pathToFileURL(resolve('../api/dist/generated/prisma/client.js')).href);
const config = dotenv.parse(await readFile(resolve('../api/.env.local')));
if (!config.TEST_DATABASE_URL || !new URL(config.TEST_DATABASE_URL).pathname.endsWith('_test')) throw new Error('Browser chat hanya memakai database test.');
test('real photo message, grouped notification, visible read receipt and private lightbox', async ({ page, browser }, info) => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.TEST_DATABASE_URL }) });
  let ownerContext;
  try {
    const seed = await db.user.findUniqueOrThrow({ where: { email: 'owner.demo@valora.local' } });
    async function actor(role = 'USER') { return db.user.create({ data: { email: `chat-browser-${randomUUID()}@demo.valora.local`, displayName: role === 'ADMIN' ? 'Admin Chat' : 'Pemilik Chat', cityId: seed.cityId, passwordHash: seed.passwordHash, emailVerifiedAt: new Date(), role } }); }
    const owner = await actor(), buyer = await actor(), admin = await actor('ADMIN');
    const ownerAccount = await login(owner.email), buyerAccount = await login(buyer.email), adminAccount = await login(admin.email);
    const fixture = await createItem(ownerAccount, 'electronics', 'Kamera chat ' + info.project.name);
    const listing = await approve(adminAccount, await createListing(ownerAccount, fixture.item, fixture.assessment, seed.cityId, 'RESELL', fixture.item.title));
    const response = await buyerAccount.request(`/listings/${listing.id}/conversations`, { method: 'POST' }); expect(response.status).toBe(201); const conversation = response.payload.data;
    async function cookies(context, account) { await context.addCookies(account.cookieHeader().split('; ').map(cookie => { const split = cookie.indexOf('='); return { name: cookie.slice(0, split), value: cookie.slice(split + 1), domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }; })); }
    await cookies(page.context(), buyerAccount);
    await page.goto('/app/pesan/' + conversation.id);
    const imagePath = resolve('public/images/keyboard.webp'); await page.getByLabel('Pilih foto pesan').setInputFiles([imagePath, imagePath, imagePath]); await expect(page.getByText('Siap', { exact: true })).toHaveCount(3);
    await page.getByLabel('Pesan', { exact: true }).fill('Tiga foto kondisi barang.'); await page.getByRole('button', { name: 'Kirim', exact: true }).click();
    await expect(page.locator('.chat-message-mine').getByText('Terkirim', { exact: true })).toBeVisible();
    await expect(page.locator('.chat-message-mine img')).toHaveCount(3); await expect.poll(() => db.messageAttachment.count({ where: { message: { conversationId: conversation.id } } })).toBe(3);
    await page.getByLabel('Pesan', { exact: true }).fill('Foto tambahan bisa menyusul.'); await page.getByRole('button', { name: 'Kirim', exact: true }).click(); await expect(page.getByText('Foto tambahan bisa menyusul.', { exact: true })).toBeVisible();
    expect(await db.inAppNotification.count({ where: { conversationId: conversation.id, userId: owner.id, readAt: null } })).toBe(1);
    ownerContext = await browser.newContext({ viewport: info.project.use.viewport, baseURL: 'http://127.0.0.1:3002' }); await cookies(ownerContext, ownerAccount); const ownerPage = await ownerContext.newPage(); await ownerPage.goto('/app/notifikasi');
    await ownerPage.getByRole('button', { name: 'Pesan', exact: true }).click(); await expect(ownerPage.locator('.notification-entry')).toHaveCount(1); await ownerPage.getByRole('link', { name: /Pesan baru/ }).click();
    await expect(ownerPage.getByText('Tiga foto kondisi barang.', { exact: true })).toBeVisible(); await expect.poll(async () => { const row = await db.conversation.findUniqueOrThrow({ where: { id: conversation.id } }); return row.participantAId === owner.id ? row.readSequenceA : row.readSequenceB; }).toBe(2);
    await expect(page.getByText('Dibaca', { exact: true })).toHaveCount(2);
    const trigger = ownerPage.getByRole('button', { name: 'Buka foto 1 dari 3' }); await trigger.click(); await expect(ownerPage.getByRole('dialog').locator('img')).toBeVisible(); await ownerPage.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    await expect(ownerPage.getByRole('link', { name: 'Buka profil Pemilik Chat' })).toHaveAttribute('href', '/profil/' + buyer.id);
    expect(await db.inAppNotification.count({ where: { conversationId: conversation.id, userId: owner.id, readAt: null } })).toBe(0);
  } finally { await ownerContext?.close(); await db.$disconnect(); }
});
