import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import dotenv from 'dotenv';
const previous = spawnSync(process.execPath, ["scripts/demo/operations.mjs"], { stdio: 'inherit', windowsHide: true });
if (previous.status !== 0) throw new Error('Fixture tahap 5 untuk demo tahap 6 gagal.');
const local = dotenv.parse(await readFile('.env.local')); process.env.VALORA_SMOKE_URL = 'http://127.0.0.1:4003';
const server = spawn(process.execPath, ['dist/main.js'], { env: { ...process.env, ...local, API_PORT: '4003' }, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] });
try {
  let ready = false; for (let i = 0; i < 100; i++) { try { if ((await fetch(process.env.VALORA_SMOKE_URL + '/api/v1/categories')).ok) { ready = true; break; } } catch {} await new Promise((r) => setTimeout(r, 100)); } if (!ready) throw new Error('API demo belum siap.');
  const { login, check } = await import("../helpers/fixtures.mjs");
  const previousFixtures = JSON.parse(await readFile(new URL("../../../../.local/stage5-demo-fixtures.json", import.meta.url), 'utf8')); const sessions = {};
  for (const name of ['owner', 'member', 'admin']) { const account = await login(name + '.demo@valora.local'); const metadata = check(await account.request('/auth/session'), 200, 'Metadata demo'); sessions[name] = { sessionId: metadata.sessionId, expiresAt: metadata.expiresAt, reauthenticatedUntil: metadata.reauthenticatedUntil }; }
  const fixtures = { ...previousFixtures, stage: 6, sessions, sessionPolicy: { absoluteDays: 7, reauthenticationMinutes: 15, grantMinutes: 5 }, routes: { ...previousFixtures.routes, sessionManagement: '/app/profil' } };
  await writeFile(new URL("../../../../.local/stage6-demo-fixtures.json", import.meta.url), JSON.stringify(fixtures, null, 2)); console.log('Fixture demo tahap 6 siap di .local/stage6-demo-fixtures.json.');
} finally { server.kill(); }
