import { aiProviderConfig } from '../../../infrastructure/ai-config.js';
export const promptVersion = 'assessment-ai-v1';
function positive(name: string, fallback: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value > 0 && value <= maximum ? value : fallback;
}
export function explainerConfig() {
  return {
    ...aiProviderConfig(), enabled: process.env.AI_EXPLAINER_ENABLED === 'true',
    timeoutMs: positive('AI_TIMEOUT_MS', 60000, 60000),
    userQuota: positive('AI_USER_DAILY_LIMIT', 20, 10000), appQuota: positive('AI_APP_DAILY_LIMIT', 200, 100000),
  };
}
export function nextWibDay(now: Date) {
  const shifted = new Date(now.getTime() + 7 * 3600000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1) - 7 * 3600000);
}
