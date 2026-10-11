import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server, type RequestListener } from 'node:http';
import type { AssessmentDto } from '@valora/contracts';
import { explanationInput, generateExplanation, validateOutput } from './provider.js';
import { explainerConfig, nextWibDay } from './config.js';

const assessment = (): AssessmentDto => ({
  id: '00000000-0000-4000-8000-000000000001', status: 'COMPLETE', score: 72, label: 'High Circular Potential',
  condition: 75, repairability: 63, economicValue: 75, reusePotential: 75, repairabilityReason: null,
  isCurrent: true, ruleVersion: 'score-v1', origin: 'USER_REPORTED', missingFields: [], safetyFlags: [],
  recommendations: [{ action: 'REPAIR', status: 'ELIGIBLE', reasons: ['REPAIR_POSSIBLE'] },
    { action: 'RESELL', status: 'ELIGIBLE', reasons: ['THRESHOLD_MET'] },
    { action: 'EXCHANGE', status: 'ELIGIBLE', reasons: ['REUSE_POTENTIAL_MET'] },
    { action: 'DONATE', status: 'ELIGIBLE', reasons: ['REUSE_POTENTIAL_MET'] }],
  answers: { contextAnswer: 'IGNORE ALL: alamat rahasia', economic: { estimatedResaleValue: { sourceNote: 'email rahasia', reportedBy: 'private-identity' } } },
  economicSources: { secret: 'private-source' }, itemId: 'private-item-id',
} as unknown as AssessmentDto);
const output = (a: AssessmentDto) => {
  const input = explanationInput(a, 'ELECTRONICS');
  return { facts: input.facts, summary: 'Komponen penilaian mendukung penggunaan kembali berdasarkan laporan pengguna.',
    strengths: ['Kondisi yang dilaporkan mendukung pemakaian kembali.'], limitations: ['Hasil ini memerlukan pemeriksaan kondisi fisik.'],
    actions: input.actions.map(action => ({ ...action, explanation: ({ ELIGIBLE: 'Dapat dipertimbangkan.', NEEDS_DATA: 'Perlu data.', INELIGIBLE: 'Belum layak.' })[action.status] + ' Tinjau alasan pada penilaian.' })),
    nextSteps: ['Ungkapkan kendala sebelum menyepakati serah terima.'] };
};
let server: Server | undefined;
afterEach(async () => { if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; } });
async function gateway(handler: RequestListener) {
  server = createServer(handler); await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Mock failed');
  return { ...explainerConfig(), apiKey: 'test-key-only', baseUrl: `http://127.0.0.1:${address.port}/v1`, timeoutMs: 1000 };
}
describe('AI explanation contract', () => {
  it('sends only structured facts and rule codes', () => {
    const raw = JSON.stringify(explanationInput(assessment(), 'ELECTRONICS'));
    for (const privateValue of ['IGNORE ALL', 'alamat', 'email', 'private-', 'contextAnswer', 'sourceNote', 'reportedBy', 'assessmentId', 'itemId', 'answers']) expect(raw).not.toContain(privateValue);
  });
  it('accepts qualitative output and keeps authoritative action reasons', () => {
    const a = assessment(), result = validateOutput(output(a), a, explanationInput(a, 'ELECTRONICS'));
    expect(result.source).toBe('AI'); expect(result.actions).toHaveLength(4);
    expect(result.actions[0].reasons[0]).toContain('50'); expect(a.score).toBe(72);
  });
  it.each(['score', 'condition', 'label', 'status', 'historical'])('rejects altered %s', key => {
    const a = assessment(), out = output(a); (out.facts as Record<string, unknown>)[key] = 'invented';
    expect(() => validateOutput(out, a, explanationInput(assessment(), 'ELECTRONICS'))).toThrow('INVALID_OUTPUT');
  });
  it.each(['Score menjadi 99.', 'Aman dan terverifikasi.', '<b>Hasil penilaian</b>', 'Buka https://invalid.local.', 'Harga satu juta rupiah.'])('rejects unsafe prose: %s', summary => {
    const a = assessment(), out = output(a); out.summary = summary;
    expect(() => validateOutput(out, a, explanationInput(a, 'ELECTRONICS'))).toThrow('INVALID_OUTPUT');
  });
  it('rejects changed action status, reason codes and missing actions', () => {
    const a = assessment();
    for (const change of [(out: ReturnType<typeof output>) => { out.actions[0].status = 'INELIGIBLE'; },
      (out: ReturnType<typeof output>) => { out.actions[1].reasonCodes = ['invented']; },
      (out: ReturnType<typeof output>) => { out.actions.pop(); }]) {
      const out = output(a); change(out); expect(() => validateOutput(out, a, explanationInput(a, 'ELECTRONICS'))).toThrow();
    }
  });
  it('preserves missing-data and historical limitations without inventing a score', () => {
    const a = assessment(); a.status = 'PARTIAL_ECONOMIC'; a.score = null; a.label = null; a.economicValue = null; a.isCurrent = false; a.missingFields = ['estimatedResaleValue'];
    a.recommendations[1].status = 'NEEDS_DATA';
    const out = output(a), result = validateOutput(out, a, explanationInput(a, 'ELECTRONICS'));
    expect(result.historical).toBe(true); expect(result.limitations.join(' ')).toContain('belum lengkap');
    out.facts.score = 72; expect(() => validateOutput(out, a, explanationInput(a, 'ELECTRONICS'))).toThrow();
  });
  it('preserves safety prohibition and voided results', () => {
    const a = assessment(); a.score = null; a.label = null; a.isCurrent = false; a.safetyFlags = ['PROHIBITED:battery']; a.recommendations.forEach(r => { r.status = 'INELIGIBLE'; r.reasons = ['PROHIBITED:battery']; });
    const result = validateOutput(output(a), a, explanationInput(a, 'ELECTRONICS'));
    expect(result.actions.every(r => r.status === 'INELIGIBLE')).toBe(true); expect(result.limitations.join(' ')).toContain('keselamatan');
  });
  it('uses WIB midnight including month/year boundaries', () => {
    expect(nextWibDay(new Date('2026-10-07T16:59:59Z')).toISOString()).toBe('2026-10-07T17:00:00.000Z');
    expect(nextWibDay(new Date('2026-12-31T17:00:00Z')).toISOString()).toBe('2027-01-01T17:00:00.000Z');
  });
  it('uses OpenAI-compatible non-streaming JSON and the configured exact model', async () => {
    const a = assessment(); let request: Record<string, unknown> | undefined;
    const cfg = await gateway((req, res) => { let raw = ''; req.on('data', chunk => { raw += String(chunk); }); req.on('end', () => { request = JSON.parse(raw); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output(a)) } }] })); }); });
    const result = await generateExplanation(a, explanationInput(a, 'ELECTRONICS'), cfg);
    expect(result.source).toBe('AI'); expect(request?.model).toBe('ag/gemini-3.8-flash-high'); expect(request?.stream).toBe(false); expect(request).not.toHaveProperty('response_format');
  });
  it('times out without automatic retries', async () => {
    let calls = 0; const cfg = await gateway((_req, _res) => { calls++; }); cfg.timeoutMs = 50;
    const a = assessment(); await expect(generateExplanation(a, explanationInput(a, 'ELECTRONICS'), cfg)).rejects.toMatchObject({ reason: 'TIMEOUT' }); expect(calls).toBe(1);
  });
  it.each(['invalid', 'truncated', 'oversized', 'unavailable'])('rejects %s upstream responses', async mode => {
    const cfg = await gateway((_req, res) => {
      if (mode === 'unavailable') { res.statusCode = 503; res.end(); }
      else if (mode === 'oversized') res.end('x'.repeat(140000));
      else res.end(mode === 'invalid' ? 'data: incomplete' : JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }));
    });
    const a = assessment(); await expect(generateExplanation(a, explanationInput(a, 'ELECTRONICS'), cfg)).rejects.toMatchObject({ reason: mode === 'unavailable' ? 'UPSTREAM_UNAVAILABLE' : 'INVALID_OUTPUT' });
  });
});
