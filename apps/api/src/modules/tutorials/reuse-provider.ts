import { AppException } from '../../shared/http.js';
import { explainerConfig } from '../assessments/explainer/config.js';

export async function generateReuseAnswer(question: string, instructions: string, config = explainerConfig()) {
  const signal = AbortSignal.timeout(config.timeoutMs);
  try {
    const response = await fetch(config.baseUrl + '/chat/completions', {
      method: 'POST', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.apiKey },
      body: JSON.stringify({ model: config.model, stream: false, max_tokens: 4096,
        messages: [{ role: 'system', content: instructions }, { role: 'user', content: question }] }),
    });
    if (response.status === 429) {
      await response.body?.cancel();
      throw new AppException(429, 'RATE_LIMITED', 'Kuota AI sedang terbatas. Coba lagi nanti.');
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error('Upstream unavailable');
    }
    const reader = response.body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 131072) { await reader.cancel(); throw new Error('Response too large'); }
      chunks.push(value);
    }
    const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { choices?: { finish_reason?: string; message?: { content?: unknown; tool_calls?: unknown; refusal?: unknown } }[] };
    const choice = envelope.choices?.[0];
    if (choice?.finish_reason === 'content_filter' || choice?.message?.refusal) return 'Aku belum bisa menyarankan tutorial yang aman untuk permintaan ini. Ada barang rumah tangga lain yang ingin kamu manfaatkan?';
    if (choice?.finish_reason !== 'stop' || choice.message?.tool_calls || typeof choice.message?.content !== 'string' || !choice.message.content.trim()) throw new Error('Incomplete response');
    return choice.message.content.trim();
  } catch (error) {
    if (error instanceof AppException) throw error;
    throw new AppException(503, 'DEPENDENCY_UNAVAILABLE', signal.aborted ? 'Asisten membutuhkan waktu terlalu lama. Coba lagi sebentar.' : 'Asisten belum bisa menjawab. Coba lagi sebentar.');
  }
}
