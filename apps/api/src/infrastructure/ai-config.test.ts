import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiProviderConfig } from './ai-config.js';
import { explainerConfig } from '../modules/assessments/explainer/config.js';
import { photoConfig } from '../modules/items/photo-provider.js';

afterEach(() => vi.unstubAllEnvs());
describe('shared AI configuration', () => {
  it('uses Gemini for both explainer and photos with only one key, even when gateway settings exist', () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key-only'); vi.stubEnv('GEMINI_MODEL', '');
    vi.stubEnv('AI_BASE_URL', 'http://localhost:20128/v1'); vi.stubEnv('AI_API_KEY', 'gateway-test-key-only');
    vi.stubEnv('AI_PHOTO_MODEL', '');
    for (const config of [aiProviderConfig(), explainerConfig(), photoConfig()]) {
      expect(config).toMatchObject({ provider: 'gemini', configured: true, model: 'gemini-2.5-flash', apiKey: 'gemini-test-key-only', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' });
    }
  });
  it('normalizes Gemini model prefixes and rejects invalid model paths', () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key-only'); vi.stubEnv('GEMINI_MODEL', 'models/gemini-2.5-flash');
    expect(aiProviderConfig().model).toBe('gemini-2.5-flash');
    vi.stubEnv('GEMINI_MODEL', '../private'); expect(aiProviderConfig().configured).toBe(false);
  });
  it('keeps the exact custom model and credentials when Gemini key is blank', () => {
    vi.stubEnv('GEMINI_API_KEY', '  '); vi.stubEnv('AI_BASE_URL', 'http://localhost:20128/v1/');
    vi.stubEnv('AI_MODEL', 'gateway/custom-model'); vi.stubEnv('AI_API_KEY', 'custom-test-key-only');
    expect(aiProviderConfig()).toMatchObject({ provider: 'custom', configured: true, baseUrl: 'http://localhost:20128/v1', model: 'gateway/custom-model', apiKey: 'custom-test-key-only' });
  });
  it('does not enable requests with missing credentials or invalid custom URLs', () => {
    vi.stubEnv('GEMINI_API_KEY', ''); vi.stubEnv('AI_API_KEY', ''); expect(aiProviderConfig().configured).toBe(false);
    vi.stubEnv('AI_API_KEY', 'custom-test-key-only'); vi.stubEnv('AI_BASE_URL', 'http://user:password@localhost/v1');
    expect(aiProviderConfig().configured).toBe(false);
  });
});
