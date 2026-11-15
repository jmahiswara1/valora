import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateReuseAnswer } from './reuse-provider.js';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const envelope = (reason = 'stop', content = 'Gunakan botol sebagai pot tanaman.') => new Response(JSON.stringify({ choices: [{ finish_reason: reason, message: { content } }] }));
describe('floating assistant shared provider', () => {
  it.each(['gemini', 'custom'])('uses the %s endpoint selected for all AI features', async provider => {
    vi.stubEnv('GEMINI_API_KEY', provider === 'gemini' ? 'gemini-test-key-only' : '');
    vi.stubEnv('GEMINI_MODEL', 'gemini-2.5-flash');
    vi.stubEnv('AI_BASE_URL', 'http://localhost:20128/v1'); vi.stubEnv('AI_MODEL', 'custom/model'); vi.stubEnv('AI_API_KEY', 'custom-test-key-only');
    const fetcher = vi.fn().mockResolvedValue(envelope()); vi.stubGlobal('fetch', fetcher);
    expect(await generateReuseAnswer('Ada botol bekas', 'Instruksi Valora')).toContain('pot tanaman');
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(provider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' : 'http://localhost:20128/v1/chat/completions');
    expect(options.headers.Authorization).toBe('Bearer ' + (provider === 'gemini' ? 'gemini-test-key-only' : 'custom-test-key-only'));
    expect(JSON.parse(options.body)).toMatchObject({ model: provider === 'gemini' ? 'gemini-2.5-flash' : 'custom/model', stream: false, messages: [{ role: 'system', content: 'Instruksi Valora' }, { role: 'user', content: 'Ada botol bekas' }] });
  });
  it.each(['length', 'empty', 'oversized', 'invalid', 'upstream'])('rejects %s responses without returning raw provider errors', async mode => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mode === 'length' ? envelope('length') : mode === 'empty' ? envelope('stop', '') : new Response(mode === 'oversized' ? 'x'.repeat(140000) : 'provider-private-details', { status: mode === 'upstream' ? 503 : 200 })));
    await expect(generateReuseAnswer('Botol', 'Valora')).rejects.toMatchObject({ status: 503 });
  });
  it('preserves safety refusal and rate-limit responses', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(envelope('content_filter')).mockResolvedValueOnce(new Response('', { status: 429 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await generateReuseAnswer('Botol', 'Valora')).toContain('aman');
    await expect(generateReuseAnswer('Botol', 'Valora')).rejects.toMatchObject({ status: 429 });
  });
});
