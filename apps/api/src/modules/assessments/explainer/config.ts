export const promptVersion = 'assessment-ai-v1';
function positive(name: string, fallback: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value > 0 && value <= maximum ? value : fallback;
}
export function explainerConfig() {
  const baseUrl = (process.env.AI_BASE_URL ?? 'http://localhost:20128/v1').trim().replace(/\/+$/, '');
  const model = (process.env.AI_MODEL ?? 'ag/gemini-3.8-flash-high').trim();
  const apiKey = (process.env.AI_API_KEY ?? '').trim();
  let validUrl = false;
  try { const url = new URL(baseUrl); validUrl = ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash; } catch { /* Incomplete configuration uses the local template. */ }
  return {
    enabled: process.env.AI_EXPLAINER_ENABLED === 'true', baseUrl, model, apiKey,
    configured: validUrl && model.length > 0 && model.length <= 160 && apiKey.length > 8 && !apiKey.includes('...'),
    timeoutMs: positive('AI_TIMEOUT_MS', 60000, 60000),
    userQuota: positive('AI_USER_DAILY_LIMIT', 20, 10000), appQuota: positive('AI_APP_DAILY_LIMIT', 200, 100000),
  };
}
export function nextWibDay(now: Date) {
  const shifted = new Date(now.getTime() + 7 * 3600000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1) - 7 * 3600000);
}
