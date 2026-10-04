import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function readPassword() {
  process.stdout.write('Password admin PostgreSQL: ');
  if (!process.stdin.isTTY) {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    return input.trim();
  }
  return new Promise((resolvePassword, reject) => {
    let input = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\r' || character === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off('data', onData);
          process.stdout.write('\n');
          resolvePassword(input);
          return;
        }
        if (character === '\u0003') {
          process.stdin.setRawMode(false);
          process.stdin.off('data', onData);
          reject(new Error('Dibatalkan'));
          return;
        }
        if (character === '\u007f') input = input.slice(0, -1);
        else input += character;
      }
    };
    process.stdin.on('data', onData);
  });
}

const password = await readPassword();
const admin = new Client({ host: '127.0.0.1', port: 5432, database: 'postgres', user: process.env.PG_ADMIN_USER ?? 'postgres', password });

try {
  await admin.connect();
  const role = 'valora_insyfest_app';
  const roleExists = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
  const localFile = resolve(process.cwd(), 'apps/api/.env.local');
  if (roleExists.rowCount) {
    try {
      await readFile(localFile, 'utf8');
      console.log('Role dan konfigurasi lokal sudah ada; tidak ada kredensial yang diubah.');
      process.exitCode = 0;
    } catch {
      throw new Error('Role Valora sudah ada tanpa konfigurasi lokal. Periksa secara manual sebelum melanjutkan.');
    }
  } else {
    const appPassword = randomBytes(32).toString('hex');
    await admin.query("CREATE ROLE valora_insyfest_app LOGIN CREATEDB PASSWORD '" + appPassword + "'");
    for (const database of ['valora_dev', 'valora_test']) {
      const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
      if (!exists.rowCount) await admin.query('CREATE DATABASE ' + database + ' OWNER valora_insyfest_app');
    }
    const localRoot = resolve(process.cwd(), '.local');
    await mkdir(localRoot, { recursive: true });
    const base = 'postgresql://valora_insyfest_app:' + appPassword + '@127.0.0.1:5432/';
    const text = [
      'DATABASE_URL=' + base + 'valora_dev',
      'TEST_DATABASE_URL=' + base + 'valora_test',
      'WEB_ORIGIN=http://localhost:3000',
      'APP_BASE_URL=http://localhost:3000',
      'API_PORT=4000',
      'APP_ENV=local',
      'MAIL_ENCRYPTION_KEY=' + randomBytes(32).toString('hex'),
      'MEDIA_SIGNING_KEY=' + randomBytes(32).toString('hex'),
      'CLOUDINARY_CLOUD_NAME=',
      'CLOUDINARY_API_KEY=',
      'CLOUDINARY_API_SECRET=',
    ].join('\n') + '\n';
    await writeFile(localFile, text, { flag: 'wx' });
    console.log('Database valora_dev dan valora_test siap. Konfigurasi hanya tersimpan di apps/api/.env.local.');
  }
} finally {
  await admin.end().catch(() => undefined);
}
