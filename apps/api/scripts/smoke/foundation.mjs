import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.VALORA_SMOKE_URL ?? 'http://127.0.0.1:4001';
const mailDirectory = resolve(process.cwd(), '../../.local/mail');
const photo = await readFile(resolve(process.cwd(), '../web/public/images/keyboard.webp'));
const password = 'Valora-Smoke-2026!';
const suffix = randomUUID().slice(0, 8);
const cityResult = await fetch(base + '/api/v1/cities?q=Bandung').then((response) => response.json());
const city = cityResult.data.find((entry) => entry.name.toLowerCase().includes('bandung'));
assert(city?.id, 'City seed unavailable');
const spec = await fetch(base + '/api/docs-json').then((response) => response.json());
assert.equal(spec.openapi, '3.1.0');
assert(spec.components.schemas.ItemCreateInput);
assert(spec.paths['/api/v1/items'].post.requestBody);

function client() {
  const cookies = new Map();
  let csrfToken = '';
  return {
    cookieHeader() { return [...cookies].map(([key, value]) => `${key}=${value}`).join('; '); },
    async request(path, { method = 'GET', body, type } = {}) {
      const headers = { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') };
      if (method !== 'GET' && method !== 'HEAD') headers['X-CSRF-Token'] = csrfToken;
      if (body !== undefined) headers['Content-Type'] = type ?? 'application/json';
      const response = await fetch(base + '/api/v1' + path, { method, headers, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
      for (const raw of response.headers.getSetCookie()) { const first = raw.split(';')[0]; const split = first.indexOf('='); cookies.set(first.slice(0, split), first.slice(split + 1)); }
      const contentType = response.headers.get('content-type') ?? '';
      const payload = contentType.includes('application/json') ? await response.json() : await response.arrayBuffer();
      if (path === '/auth/csrf' && response.ok) csrfToken = payload.data.token;
      return { status: response.status, payload, contentType };
    },
  };
}
async function mailToken(recipient, kind) {
  for (let attempt = 0; attempt < 25; attempt++) {
    const files = await readdir(mailDirectory);
    for (const file of files) {
      const content = await readFile(resolve(mailDirectory, file), 'utf8');
      if (!content.includes('Kepada: ' + recipient) || !content.includes(kind)) continue;
      const token = content.match(/\?token=([^\s]+)/)?.[1];
      if (token) return decodeURIComponent(token);
    }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error('Local mail token unavailable');
}
function status(result, expected, label) {
  assert.equal(result.status, expected, `${label}: ${JSON.stringify(result.payload)}`);
}

const owner = client();
status(await owner.request('/me'), 401, 'Guest profile guard');
const noCsrf = await owner.request('/auth/register', { method: 'POST', body: {} });
status(noCsrf, 403, 'CSRF guard');
status(await owner.request('/auth/csrf'), 200, 'CSRF token');
const email = `smoke-${suffix}@example.test`;
status(await owner.request('/auth/register', { method: 'POST', body: { email, password, displayName: 'Smoke Owner', cityId: city.id } }), 201, 'Register');
status(await owner.request('/auth/register', { method: 'POST', body: { email, password, displayName: 'Smoke Owner', cityId: city.id } }), 409, 'Duplicate email');
const verification = await mailToken(email, 'Verifikasi email');
status(await owner.request('/auth/verify-email', { method: 'POST', body: { token: verification } }), 201, 'Verify');
status(await owner.request('/auth/verify-email', { method: 'POST', body: { token: verification } }), 400, 'Single-use verification');
status(await owner.request('/auth/login', { method: 'POST', body: { email, password } }), 201, 'Login');
status(await owner.request('/items', { method: 'POST', body: { title: 'Keyboard lama', description: 'Keyboard masih berfungsi.', categoryCode: 'electronics', uploadTicketIds: [] } }), 400, 'First photo required');
const invalidTicket = await owner.request('/media/tickets', { method: 'POST', body: { fileName: 'fake.png', mime: 'image/png', bytes: 5 } });
status(invalidTicket, 201, 'Invalid photo ticket');
status(await owner.request('/media/uploads/' + invalidTicket.payload.data.ticketId, { method: 'PUT', body: Buffer.from('hello'), type: 'image/png' }), 400, 'Image content sniff');

const ticket = await owner.request('/media/tickets', { method: 'POST', body: { fileName: 'keyboard.webp', mime: 'image/webp', bytes: photo.length } });
status(ticket, 201, 'Photo ticket');
status(await owner.request('/media/uploads/' + ticket.payload.data.ticketId, { method: 'PUT', body: photo, type: 'image/webp' }), 200, 'Photo upload');
const created = await owner.request('/items', { method: 'POST', body: { title: 'Keyboard lama', description: 'Keyboard masih berfungsi.', categoryCode: 'electronics', uploadTicketIds: [ticket.payload.data.ticketId] } });
status(created, 201, 'Item creation');
const item = created.payload.data;
assert.equal(item.media.length, 1);
status(await owner.request('/items', { method: 'POST', body: { title: 'Keyboard dua', description: 'Percobaan tiket digunakan ulang.', categoryCode: 'electronics', uploadTicketIds: [ticket.payload.data.ticketId] } }), 400, 'Ticket single use');
const access = await owner.request('/media/' + item.media[0].id + '/access');
status(access, 200, 'Private photo access');
const image = await fetch(base + access.payload.data.url, { headers: { Cookie: owner.cookieHeader() } });
assert.equal(image.status, 200);
assert.match(image.headers.get('content-type'), /image\/webp/);

const other = client();
status(await other.request('/auth/csrf'), 200, 'Second CSRF token');
const otherEmail = `smoke-other-${suffix}@example.test`;
status(await other.request('/auth/register', { method: 'POST', body: { email: otherEmail, password, displayName: 'Smoke Other', cityId: city.id } }), 201, 'Second registration');
status(await other.request('/auth/login', { method: 'POST', body: { email: otherEmail, password } }), 201, 'Second login');
status(await other.request('/items/' + item.id), 404, 'Private Item guard');
status(await other.request('/media/' + item.media[0].id + '/access'), 404, 'Private media guard');
const stolenUrl = await fetch(base + access.payload.data.url, { headers: { Cookie: other.cookieHeader() } });
assert.equal(stolenUrl.status, 403, 'Signed URL bound to owner session');
status(await other.request('/admin/overview'), 403, 'Admin role guard');
const otherItems = await other.request('/items');
status(otherItems, 200, 'Owner list');
assert.equal(otherItems.payload.data.length, 0);

status(await owner.request('/items/' + item.id, { method: 'PATCH', body: { expectedVersion: item.version + 1, title: 'Keyboard baru' } }), 409, 'Optimistic version');
const edited = await owner.request('/items/' + item.id, { method: 'PATCH', body: { expectedVersion: item.version, title: 'Keyboard terawat' } });
status(edited, 200, 'Item update');
assert.equal(edited.payload.data.title, 'Keyboard terawat');
status(await owner.request('/items/' + item.id + '/media/' + item.media[0].id, { method: 'DELETE' }), 409, 'Keep last photo');
const genericUnknown = await owner.request('/auth/password-reset/request', { method: 'POST', body: { email: `absent-${suffix}@example.test` } });
const genericExisting = await owner.request('/auth/password-reset/request', { method: 'POST', body: { email } });
status(genericUnknown, 201, 'Unknown reset request');
status(genericExisting, 201, 'Known reset request');
assert.equal(genericUnknown.payload.data.message, genericExisting.payload.data.message, 'Reset request must not disclose account existence');
const resetToken = await mailToken(email, 'Atur ulang kata sandi');
status(await owner.request('/auth/password-reset/confirm', { method: 'POST', body: { token: resetToken, password: password + 'New' } }), 201, 'Reset password');
status(await owner.request('/me'), 401, 'Password reset revokes sessions');
status(await owner.request('/auth/login', { method: 'POST', body: { email, password: password + 'New' } }), 201, 'Login after reset');
status(await other.request('/me/close', { method: 'POST', body: {} }), 201, 'Account closure');
status(await other.request('/me'), 401, 'Closed session revoked');
console.log('Stage 1 smoke passed: auth, CSRF, verification, reset, Item, photo validation, privacy, version and account closure.');
