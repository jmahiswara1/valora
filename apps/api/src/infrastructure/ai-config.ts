// Gemini and custom gateways use the same OpenAI-compatible request format.
export function aiProviderConfig() {
  const geminiKey = process.env.GEMINI_API_KEY?.trim() ?? '';
  const provider = geminiKey ? 'gemini' : 'custom';
  const baseUrl = (geminiKey ? 'https://generativelanguage.googleapis.com/v1beta/openai' : process.env.AI_BASE_URL ?? 'http://localhost:20128/v1').trim().replace(/\/+$/, '');
  const selectedModel = (geminiKey ? process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash' : process.env.AI_MODEL ?? 'ag/gemini-3.8-flash-high').trim();
  const model = geminiKey ? selectedModel.replace(/^models\//, '') : selectedModel;
  const apiKey = geminiKey || process.env.AI_API_KEY?.trim() || '';
  let validUrl = false;
  try {
    const url = new URL(baseUrl);
    validUrl = ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
  } catch { /* Invalid configuration keeps the existing template fallback. */ }
  return {
    provider, baseUrl, model, apiKey,
    configured: validUrl && model.length > 0 && model.length <= 160 && apiKey.length > 8 && !apiKey.includes('...') && (!geminiKey || /^[\w.-]+$/.test(model)),
  };
}
