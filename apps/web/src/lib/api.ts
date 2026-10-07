import type { ApiError, ApiSuccess } from '@valora/contracts';

export class ApiClientError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
  }
}

let sessionGeneration = 0;
const inflight = new Set<AbortController>();
export function advanceSessionGeneration() { sessionGeneration++; for (const controller of inflight) controller.abort(); inflight.clear(); csrfToken = null; csrfPending = null; }
let csrfToken: string | null = null;
let csrfPending: { generation: number; promise: Promise<string> } | null = null;

async function csrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const generation = sessionGeneration;
  if (csrfPending?.generation === generation) return csrfPending.promise;
  // Concurrent photo uploads must share one cookie/header pair.
  const promise = (async () => {
    const response = await fetch('/api/v1/auth/csrf', { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new ApiClientError(response.status, 'DEPENDENCY_UNAVAILABLE', 'Tidak dapat memulai formulir. Coba lagi.');
    const result = await response.json() as ApiSuccess<{ token: string }>;
    if (generation !== sessionGeneration) throw new ApiClientError(409, 'SESSION_CHANGED', 'Sesi sudah berubah.');
    csrfToken = result.data.token;
    return csrfToken;
  })();
  csrfPending = { generation, promise };
  try { return await promise; } finally { if (csrfPending?.promise === promise) csrfPending = null; }
}

type RequestOptions = { method?: string; body?: unknown; headers?: Record<string, string> };

export async function apiEnvelope<T>(path: string, options: RequestOptions = {}, retryCsrf = true): Promise<ApiSuccess<T>> {
  const generation = sessionGeneration;
  const method = options.method ?? 'GET';
  const unsafe = !['GET', 'HEAD'].includes(method.toUpperCase());
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (unsafe) headers['X-CSRF-Token'] = await csrf();
  let body: BodyInit | undefined;
  if (options.body instanceof Blob) {
    body = options.body;
    headers['Content-Type'] = options.body.type;
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers['Content-Type'] = 'application/json';
  }
  const controller = new AbortController(); const scoped = !path.startsWith('/auth/');
  // CSRF retrieval can outlive an account switch. Do not dispatch a private
  // mutation with credentials from the next session.
  if (scoped && generation !== sessionGeneration) throw new ApiClientError(409, 'SESSION_CHANGED', 'Sesi sudah berubah.');
  if (scoped) inflight.add(controller);
  let response: Response; let result: ApiSuccess<T> | ApiError;
  try { response = await fetch('/api/v1' + path, { method, body, headers, credentials: 'include', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }); result = await response.json() as ApiSuccess<T> | ApiError; } finally { inflight.delete(controller); }
  if (scoped && generation !== sessionGeneration) throw new ApiClientError(409, 'SESSION_CHANGED', 'Sesi sudah berubah.');
  if (!response.ok) {
    const error = 'error' in result ? result.error : { code: 'INTERNAL_ERROR', message: 'Permintaan gagal.' };
    if (unsafe && retryCsrf && response.status === 403 && error.message.includes('Token keamanan')) {
      csrfToken = null;
      return apiEnvelope<T>(path, options, false);
    }
    if (typeof window !== 'undefined') {
      if (error.code === 'UNAUTHENTICATED' || error.code === 'ACCOUNT_SUSPENDED') window.dispatchEvent(new CustomEvent('valora-auth-error', { detail: error.code }));
      if (error.code === 'ACCESS_REASON_REQUIRED' || error.code === 'CASE_NOT_ASSIGNED' || (response.status === 404 && /^\/admin\/cases\/[^/]+\/handover$/.test(path.split('?')[0]))) window.dispatchEvent(new CustomEvent('valora-access-error', { detail: path }));
      if (error.code === 'REAUTHENTICATION_REQUIRED') window.dispatchEvent(new Event('valora-reauthenticate'));
    }
    throw new ApiClientError(response.status, error.code, error.message, 'details' in error ? error.details : undefined);
  }
  return result as ApiSuccess<T>;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await apiEnvelope<T>(path, options)).data;
}
