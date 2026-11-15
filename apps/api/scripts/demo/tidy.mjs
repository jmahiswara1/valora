import { Client } from 'pg';
import dotenv from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Local fixture maintenance: preserve identities, passwords, ownership, and formal history.
const local = dotenv.parse(await readFile('.env.local'));
const target = new URL(local.DATABASE_URL);
if (local.APP_ENV !== 'local' || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/valora_dev') {
  throw new Error('Perapian hanya diizinkan pada database lokal valora_dev.');
}
const apply = process.argv.includes('--apply');
const accounts = ['admin', 'buyer', 'owner', 'member'].map(name => ({ email: name + '@valora.demo', legacy: name + '.demo@valora.local' }));
function title(value) {
  const market = /^Demo Market · [^·]+ · \d+ · (.+)$/.exec(value);
  if (market) return market[1].trim();
  if (/^Demo Exchange /i.test(value)) return /paket/i.test(value) ? 'Paket Kursi Kayu' : 'Kursi Kayu';
  if (/^Demo panduan.*pegangan laci/i.test(value)) return 'Laci Kayu';
  if (/^(Demo tahap [45] |Demo Item penukar |Barang penukar privat |Demo panduan.*perawatan keyboard|Keyboard visual tahap dua|Keyboard contoh \(data demo\))/i.test(value)) return 'Keyboard';
  return value;
}
const db = new Client({ connectionString: local.DATABASE_URL });
await db.connect();
const root = resolve('../../.local');
try {
  await db.query('BEGIN');
  const users = (await db.query('SELECT id,email,version FROM "User" WHERE email = ANY($1::text[]) FOR UPDATE', [accounts.flatMap(a => [a.email, a.legacy])])).rows;
  for (const account of accounts) {
    const matches = users.filter(u => [account.email, account.legacy].includes(u.email));
    if (matches.length !== 1) throw new Error('Harus ada tepat satu akun: ' + account.email);
  }
  const ids = users.map(u => u.id);
  const items = (await db.query('SELECT id,title,version FROM "Item" WHERE "currentOwnerId" = ANY($1::uuid[]) FOR UPDATE', [ids])).rows;
  const listings = (await db.query('SELECT l.id,l.version,r.id AS "revisionId",r.title FROM "Listing" l JOIN "ListingRevision" r ON r.id=l."currentRevisionId" WHERE l."ownerId" = ANY($1::uuid[]) FOR UPDATE OF l,r', [ids])).rows;
  const changes = {
    accounts: users.filter(u => u.email.endsWith('@valora.local')),
    items: items.filter(i => title(i.title) !== i.title),
    listings: listings.filter(l => title(l.title) !== l.title),
  };
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', accounts: changes.accounts.length, items: changes.items.length, listings: changes.listings.length, samples: changes.items.slice(0, 5).map(i => ({ before: i.title, after: title(i.title) })) }, null, 2));
  if (!apply) {
    await db.query('ROLLBACK');
  } else {
    await mkdir(root, { recursive: true });
    const backup = resolve(root, 'demo-tidy-' + new Date().toISOString().replaceAll(/[:.]/g, '-') + '.json');
    await writeFile(backup, JSON.stringify({ createdAt: new Date().toISOString(), ...changes }, null, 2), { flag: 'wx', mode: 0o600 });
    for (const user of changes.accounts) {
      const account = accounts.find(a => a.legacy === user.email);
      await db.query('UPDATE "User" SET email=$1,version=version+1,"updatedAt"=NOW() WHERE id=$2', [account.email, user.id]);
    }
    // Cosmetic fixture titles keep assessment revisions valid; versions refresh stale clients.
    for (const item of changes.items) await db.query('UPDATE "Item" SET title=$1,version=version+1,"updatedAt"=NOW() WHERE id=$2', [title(item.title), item.id]);
    for (const listing of changes.listings) {
      await db.query('UPDATE "ListingRevision" SET title=$1 WHERE id=$2', [title(listing.title), listing.revisionId]);
      await db.query('UPDATE "Listing" SET version=version+1,"updatedAt"=NOW() WHERE id=$1', [listing.id]);
    }
    await db.query('COMMIT');
    console.log('Database diperbarui. Salinan nilai sebelumnya: ' + backup);
    const replace = value => {
      if (typeof value === 'string') return accounts.find(a => a.legacy === value)?.email ?? title(value);
      if (Array.isArray(value)) return value.map(replace);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replace(entry)]));
      return value;
    };
    for (const name of ['demo-credentials.json', 'demo-items-fixtures.json', 'stage4-demo-fixtures.json', 'stage5-demo-fixtures.json', 'stage6-demo-fixtures.json', 'advanced-exchange-demo.json']) {
      const file = resolve(root, name);
      let original;
      try { original = JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      const updated = replace(original);
      if (JSON.stringify(original) !== JSON.stringify(updated)) await writeFile(file, JSON.stringify(updated, null, 2) + '\n', { mode: 0o600 });
    }
  }
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await db.end();
}
