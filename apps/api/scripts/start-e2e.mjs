import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';

const local = dotenv.parse(await readFile('.env.local'));
if (!local.TEST_DATABASE_URL || !new URL(local.TEST_DATABASE_URL).pathname.endsWith('_test')) throw new Error('E2E membutuhkan database test.');
const env = { ...process.env, ...local, DATABASE_URL: local.TEST_DATABASE_URL, API_PORT: '4001', WEB_ORIGIN: 'http://127.0.0.1:3002', APP_BASE_URL: 'http://127.0.0.1:3002' };
const prisma = createRequire(import.meta.url).resolve('prisma/build/index.js');
for (const args of [[prisma, 'migrate', 'deploy'], ['dist/seed.js'], ["scripts/database/reset-rate-buckets.mjs"]]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Persiapan API E2E gagal.');
}
const server = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.kill());
server.on('exit', (code) => process.exit(code ?? 0));
