import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { handoverActors, handoverTransaction } from '../../../api/scripts/helpers/handover.mjs';
const require = createRequire(resolve('../api/package.json'));
const { PrismaPg } = require('@prisma/adapter-pg'), dotenv = require('dotenv');
const { PrismaClient } = await import(pathToFileURL(resolve('../api/dist/generated/prisma/client.js')).href);
const config = dotenv.parse(await readFile(resolve('../api/.env.local')));
if (!config.TEST_DATABASE_URL || !new URL(config.TEST_DATABASE_URL).pathname.endsWith('_test')) throw new Error('Handover browser requires test database.');
test('real participants agree delivery, record resi and retain formal confirmation rules', async ({ browser }, info) => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.TEST_DATABASE_URL }) }), contexts = [];
  try {
    const actors = await handoverActors(db), transaction = await handoverTransaction(db, actors);
    async function pageFor(actor) { const context = await browser.newContext({ viewport: info.project.use.viewport, baseURL: 'http://127.0.0.1:3002' }); contexts.push(context); await context.addCookies(actor.account.cookieHeader().split('; ').map(cookie => { const split = cookie.indexOf('='); return { name: cookie.slice(0, split), value: cookie.slice(split + 1), domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }; })); const page = await context.newPage(); await page.goto(`/app/transaksi/${transaction.id}`); return page; }
    const owner = await pageFor(actors.owner), buyer = await pageFor(actors.buyer);
    await owner.getByRole('button', { name: 'Atur serah terima', exact: true }).click(); await owner.getByLabel('Metode serah terima').click(); await owner.getByRole('option', { name: 'Pengiriman', exact: true }).click(); await owner.getByLabel('Perkiraan tanggal dan waktu diterima').fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16)); await owner.getByRole('button', { name: 'Kirim usulan', exact: true }).click(); await expect(owner.getByRole('dialog')).toHaveCount(0);
    await buyer.reload(); await buyer.getByRole('button', { name: 'Tinjau usulan' }).click(); await buyer.getByLabel('Nama penerima', { exact: true }).fill('Penerima Browser'); await buyer.getByLabel('Nomor telepon penerima').fill('081234567890'); await buyer.getByLabel('Alamat lengkap').fill('Jalan Koordinasi Browser nomor 12, Kediri'); await buyer.getByRole('button', { name: 'Setujui usulan', exact: true }).click(); await expect(buyer.getByRole('dialog')).toHaveCount(0);
    await owner.reload(); await owner.getByRole('button', { name: 'Catat resi', exact: true }).click(); await owner.getByLabel('Kurir', { exact: true }).fill('Kurir Browser'); await owner.getByLabel('Nomor resi', { exact: true }).fill('BROWSER-001'); await owner.getByRole('button', { name: 'Simpan resi', exact: true }).click(); await expect(owner.getByText('BROWSER-001', { exact: true })).toBeVisible();
    expect(await db.shipmentRecord.count({ where: { proposal: { transactionId: transaction.id } } })).toBe(1); expect((await db.item.findUniqueOrThrow({ where: { id: transaction.snapshot.items[0].id } })).currentOwnerId).toBe(actors.owner.user.id);
    await owner.getByRole('button', { name: 'Konfirmasi penyerahan', exact: true }).click(); await owner.getByRole('checkbox').check(); await owner.getByRole('button', { name: 'Simpan konfirmasi', exact: true }).click(); await expect(owner.getByRole('dialog')).toHaveCount(0); await expect(owner.getByRole('button', { name: 'Usulkan perubahan', exact: true })).toHaveCount(0); await expect(owner.getByRole('button', { name: 'Perbaiki resi', exact: true })).toBeVisible();
    await buyer.reload(); await buyer.getByRole('button', { name: 'Konfirmasi penerimaan', exact: true }).click(); await buyer.getByRole('checkbox').check(); await buyer.getByRole('button', { name: 'Simpan konfirmasi', exact: true }).click(); await expect(buyer.getByText('Kepemilikan telah berpindah.', { exact: false })).toBeVisible(); expect((await db.item.findUniqueOrThrow({ where: { id: transaction.snapshot.items[0].id } })).currentOwnerId).toBe(actors.buyer.user.id);
    expect(await db.inAppNotification.count({ where: { type: 'HANDOVER_APPROVED', userId: actors.owner.user.id } })).toBe(1); await buyer.getByRole('button', { name: 'Lihat detail', exact: true }).first().click(); await expect(buyer.getByRole('dialog').getByText('Jalan Koordinasi Browser nomor 12, Kediri')).toBeVisible();
  } finally { for (const context of contexts) await context.close(); await db.$disconnect(); }
});
