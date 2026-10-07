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
if (!config.TEST_DATABASE_URL || !new URL(config.TEST_DATABASE_URL).pathname.endsWith('_test')) throw new Error('Browser ulasan hanya memakai database test.');
test('real completed transaction publishes rating, reply and notifications', async ({ page, browser }, info) => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.TEST_DATABASE_URL }) });
  const contexts = [];
  try {
    const seed = await db.user.findUniqueOrThrow({ where: { email: 'owner.demo@valora.local' } });
    async function actor(role = 'USER') { return db.user.create({ data: { email: `review-browser-${randomUUID()}@demo.valora.local`, displayName: 'Ulasan Browser ' + role, cityId: seed.cityId, passwordHash: seed.passwordHash, emailVerifiedAt: new Date(), role } }); }
    const owner = await actor(), buyer = await actor(), admin = await actor('ADMIN');
    const ownerAccount = await login(owner.email), buyerAccount = await login(buyer.email), adminAccount = await login(admin.email);
    const fixture = await createItem(ownerAccount, 'electronics', 'Perangkat ulasan ' + info.project.name);
    const listing = await approve(adminAccount, await createListing(ownerAccount, fixture.item, fixture.assessment, seed.cityId, 'RESELL', fixture.item.title));
    const offer = check(await buyerAccount.request(`/listings/${listing.id}/offers`, { method: 'POST', body: { expectedListingVersion: listing.version, listingRevisionId: listing.revision.id, clientRequestId: randomUUID(), priceIdr: 300000 } }), 201, 'Offer browser');
    const mutate = (account, path, body) => account.request(path, { method: 'POST', body, extraHeaders: { 'Idempotency-Key': randomUUID() } });
    let tx = check(await mutate(ownerAccount, `/offers/${offer.id}/accept`, { expectedVersion: offer.version, offerRevisionId: offer.currentRevision.id, listingRevisionId: offer.listingRevisionId }), 201, 'Accept browser');
    for (const c of tx.requiredConfirmations) tx = check(await mutate(c.actorId === owner.id ? ownerAccount : buyerAccount, `/transactions/${tx.id}/confirmations`, { expectedVersion: tx.version, itemId: c.itemId, kind: c.kind }), 201, 'Serah terima browser');
    await page.goto('/masuk?next=' + encodeURIComponent('/app/transaksi/' + tx.id));
    await page.getByLabel('Email', { exact: true }).fill(buyer.email); await page.getByLabel('Kata sandi', { exact: true }).fill(credentials.password); await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await page.getByRole('radio', { name: '5 bintang' }).check(); await page.getByLabel('Komentar (opsional)').fill('Barang sesuai informasi dan serah terima berjalan baik.'); await page.getByRole('button', { name: 'Kirim ulasan', exact: true }).click();
    await expect(page.getByText('Ulasan sudah dikirim.')).toBeVisible();
    expect(await db.review.count({ where: { transactionId: tx.id, authorId: buyer.id } })).toBe(1);
    await page.goto(`/profil/${owner.id}?tab=ulasan`); await expect(page.getByText('Barang sesuai informasi dan serah terima berjalan baik.')).toBeVisible(); await expect(page.locator('.public-profile-rating strong')).toHaveText('5,0 / 5');
    const context = await browser.newContext({ viewport: info.project.use.viewport, baseURL: 'http://127.0.0.1:3002' }); contexts.push(context);
    await context.addCookies(ownerAccount.cookieHeader().split('; ').map(cookie => { const index = cookie.indexOf('='); return { name: cookie.slice(0, index), value: cookie.slice(index + 1), domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }; }));
    const ownerPage = await context.newPage(); await ownerPage.goto(`/app/transaksi/${tx.id}`); await ownerPage.getByRole('button', { name: 'Balas ulasan' }).click(); await ownerPage.getByLabel('Balasanmu').fill('Terima kasih sudah menggunakan kembali barangnya.'); await ownerPage.getByRole('button', { name: 'Kirim balasan' }).click(); await expect(ownerPage.getByText('Terima kasih sudah menggunakan kembali barangnya.')).toBeVisible();
    await page.goto('/app/notifikasi'); const notification = page.getByRole('link', { name: /Balasan ulasan/ }); await expect(notification).toBeVisible(); await notification.click(); await expect(page).toHaveURL(new RegExp('/app/transaksi/' + tx.id)); await expect(page.getByText('Terima kasih sudah menggunakan kembali barangnya.')).toBeVisible();
    expect(await db.inAppNotification.count({ where: { userId: buyer.id, type: 'REVIEW_REPLY_RECEIVED' } })).toBe(1); expect(await db.inAppNotification.count({ where: { userId: owner.id, type: 'REVIEW_RECEIVED' } })).toBe(1);
  } finally { for (const context of contexts) await context.close(); await db.$disconnect(); }
});
