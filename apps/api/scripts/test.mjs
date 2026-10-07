import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

const local = dotenv.parse(await readFile('.env.local'));
if (!local.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL tidak ada di apps/api/.env.local');
const env = { ...process.env, ...local, DATABASE_URL: local.TEST_DATABASE_URL, API_PORT: '4001', VALORA_SMOKE_URL: 'http://127.0.0.1:4001' };
const require = createRequire(import.meta.url);
const prisma = require.resolve('prisma/build/index.js');

function run(file, args) {
  const result = spawnSync(process.execPath, [file, ...args], { env, stdio: 'inherit', cwd: process.cwd() });
  if (result.status !== 0) throw new Error(`${file} gagal (${result.status ?? result.error?.message})`);
}

run(prisma, ['migrate', 'deploy']);
run(resolve(process.cwd(), 'dist/seed.js'), []);
run(resolve(process.cwd(), "scripts/database/reset-rate-buckets.mjs"), []);
const api = spawn(process.execPath, ['dist/main.js'], { env, cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
api.stdout.on('data', (chunk) => { logs += chunk.toString(); });
api.stderr.on('data', (chunk) => { logs += chunk.toString(); });

try {
  let ready = false;
  for (let attempt = 0; attempt < 400; attempt++) {
    if (api.exitCode !== null) throw new Error('API uji berhenti sebelum siap.\n' + logs);
    try { const response = await fetch(env.VALORA_SMOKE_URL + '/api/v1/categories'); if (response.ok) { ready = true; break; } } catch { /* Startup still pending. */ }
    await new Promise((done) => setTimeout(done, 150));
  }
  if (!ready) throw new Error('API uji tidak siap.\n' + logs);
  run(resolve(process.cwd(), "scripts/smoke/foundation.mjs"), []);
  run(resolve(process.cwd(), "scripts/smoke/assessments.mjs"), []);
  run(resolve(process.cwd(), "scripts/smoke/market.mjs"), []);
  run(resolve(process.cwd(), "scripts/smoke/transactions.mjs"), []);
  run(resolve(process.cwd(), "scripts/smoke/operations.mjs"), []);
  run(resolve(process.cwd(), "scripts/smoke/session.mjs"), []);
  run(resolve(process.cwd(), "scripts/smoke/favorites.mjs"), []);
  run(resolve(process.cwd(), "scripts/smoke/notifications.mjs"), []);
} catch (error) {
  await new Promise((done) => setTimeout(done, 50));
  console.error(logs);
  throw error;
} finally {
  api.kill();
}
