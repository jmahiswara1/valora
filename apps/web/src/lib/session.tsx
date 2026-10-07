'use client';
import { ConversationRealtime } from './realtime';
import { NotificationFeedback } from '@/features/notifications/feedback';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { actionOperationFor, type SessionDto } from '@valora/contracts';
import { api, ApiClientError, advanceSessionGeneration } from './api';
import { Button, Field, Input, Notice } from "@/components/ui/primitives";

type State = SessionDto['state'] | 'CHECKING' | 'UNAVAILABLE' | 'LOGOUT_PENDING';
type Value = { state: State; session: SessionDto | null; verifiedPath: string; logoutBusy: boolean; refresh: () => Promise<SessionDto | null>; logout: () => Promise<void>; changed: () => Promise<SessionDto | null> };
const Context = createContext<Value | null>(null);
function cleanBrowserStorage() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith('valora-action:')) {
        try { const raw = JSON.parse(sessionStorage.getItem(key) ?? 'null'); const actorId = key.split(':')[1]; const operation = raw.operation ?? actionOperationFor(raw.path, raw.body); sessionStorage.setItem(key, JSON.stringify({ actorId, operation, key: raw.key })); }
        catch { sessionStorage.removeItem(key); }
      } else if (key?.startsWith('valora-')) sessionStorage.removeItem(key);
    }
  } catch { /* Session authorization does not depend on browser storage availability. */ }
}

function CacheScope({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }));
  useEffect(() => () => { void client.cancelQueries(); client.clear(); }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useEffect(() => { cleanBrowserStorage(); }, []);
  const [state, setState] = useState<State>('CHECKING'); const [session, setSession] = useState<SessionDto | null>(null); const [verifiedPath, setVerifiedPath] = useState(''); const [generation, setGeneration] = useState(0); const [logoutBusy, setLogoutBusy] = useState(false); const logoutRunning = useRef(false);
  const identity = useRef(''); const pending = useRef<Promise<SessionDto | null> | null>(null); const version = useRef(0); const path = useRef(pathname); const channel = useRef<BroadcastChannel | null>(null); const logoutPending = useRef(false);
  useEffect(() => { path.current = pathname; }, [pathname]);
  const clear = useCallback(() => {
    advanceSessionGeneration(); setGeneration((v) => v + 1);
    cleanBrowserStorage();
  }, []);
  const refresh = useCallback(function refreshSession(): Promise<SessionDto | null> {
    if (pending.current) return pending.current;
    const requestVersion = version.current; const requestPath = path.current;
    const task = (async () => {
      try {
        const result = await api<SessionDto>('/auth/session');
        if (requestVersion !== version.current) return null;
        const nextIdentity = result.sessionId ?? result.state;
        if (identity.current !== nextIdentity) { if (identity.current) clear(); identity.current = nextIdentity; }
        if (logoutPending.current && result.state === 'AUTHENTICATED') { setState('LOGOUT_PENDING'); setSession(null); return result; }
        logoutPending.current = false; setSession(result); setState(result.state); setVerifiedPath(requestPath); return result;
      } catch { if (requestVersion === version.current) { setState(logoutPending.current ? 'LOGOUT_PENDING' : 'UNAVAILABLE'); setVerifiedPath(''); } return null; }
    })();
    pending.current = task; void task.finally(() => { if (pending.current === task) pending.current = null; if (path.current !== requestPath && requestVersion === version.current) void refreshSession(); }); return task;
  }, [clear]);
  const notify = useCallback(() => { channel.current?.postMessage('changed'); try { localStorage.setItem('valora-session-change', crypto.randomUUID()); } catch { /* BroadcastChannel remains available when storage is blocked. */ } }, []);
  const changed = useCallback(async () => { version.current++; pending.current = null; setVerifiedPath(''); const result = await refresh(); notify(); return result; }, [refresh, notify]);
  const logout = useCallback(async () => {
    if (logoutRunning.current) return;
    logoutRunning.current = true; setLogoutBusy(true);
    version.current++; pending.current = null; logoutPending.current = true; setState('LOGOUT_PENDING'); setSession(null); setVerifiedPath(''); clear(); notify();
    try { await api('/auth/logout', { method: 'POST' }); logoutPending.current = false; await changed(); } catch { await refresh(); } finally { logoutRunning.current = false; setLogoutBusy(false); }
  }, [changed, clear, notify, refresh]);
  useEffect(() => { path.current = pathname; void refresh(); }, [pathname, refresh]);
  useEffect(() => {
    const check = () => { if (document.visibilityState === 'visible') void refresh(); };
    const invalidate = () => { version.current++; pending.current = null; setVerifiedPath(''); clear(); void refresh(); };
    const onApiError = (event: Event) => { const code = (event as CustomEvent<string>).detail; if (code === 'UNAUTHENTICATED' || code === 'ACCOUNT_SUSPENDED') invalidate(); };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) setVerifiedPath(''); check(); };
    const onStorage = (e: StorageEvent) => { if (e.key === 'valora-session-change') invalidate(); };
    if (typeof BroadcastChannel !== 'undefined') { channel.current = new BroadcastChannel('valora-session'); channel.current.onmessage = invalidate; }
    window.addEventListener('storage', onStorage); window.addEventListener('focus', check); window.addEventListener('online', check); window.addEventListener('pageshow', onPageShow); window.addEventListener('valora-auth-error', onApiError); document.addEventListener('visibilitychange', check);
    const timer = setInterval(() => { if (identity.current && !['GUEST', 'RESTRICTED'].includes(identity.current)) check(); }, 30000);
    return () => { clearInterval(timer); channel.current?.close(); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', check); window.removeEventListener('online', check); window.removeEventListener('pageshow', onPageShow); window.removeEventListener('valora-auth-error', onApiError); document.removeEventListener('visibilitychange', check); };
  }, [clear, refresh]);
  const value = useMemo(() => ({ state, session, verifiedPath, logoutBusy, refresh, logout, changed }), [state, session, verifiedPath, logoutBusy, refresh, logout, changed]);
  return <Context.Provider value={value}><CacheScope key={generation}><ConversationRealtime sessionId={state === 'AUTHENTICATED' ? session?.sessionId : null}>{children}<NotificationFeedback /><ReauthenticationDialog /></ConversationRealtime></CacheScope></Context.Provider>;
}
export function useSession() { const value = useContext(Context); if (!value) throw new Error('SessionProvider missing'); return value; }
export function useMe() {
  const context = useSession();
  return { data: context.state === 'AUTHENTICATED' ? context.session?.user ?? undefined : undefined, isPending: context.state === 'CHECKING', isError: !['CHECKING', 'AUTHENTICATED'].includes(context.state), error: new ApiClientError(context.state === 'GUEST' ? 401 : 503, context.state, 'Status sesi belum tersedia.'), refetch: context.refresh };
}
function ReauthenticationDialog() {
  const [open, setOpen] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const dialog = useRef<HTMLDialogElement>(null); const context = useSession();
  useEffect(() => { const listener = () => { setOpen(true); setError(''); }; window.addEventListener('valora-reauthenticate', listener); return () => window.removeEventListener('valora-reauthenticate', listener); }, []);
  useEffect(() => { if (!open) return; const trigger = document.activeElement as HTMLElement | null; dialog.current?.showModal(); return () => trigger?.focus(); }, [open]);
  if (!open) return null;
  return <dialog ref={dialog} className="transaction-dialog" aria-labelledby="reauth-title" onCancel={() => setOpen(false)}><form className="form-stack" onSubmit={async (e) => { e.preventDefault(); const password = new FormData(e.currentTarget).get('password'); setBusy(true); setError(''); try { await api('/auth/reauthenticate', { method: 'POST', body: { password } }); await context.refresh(); setOpen(false); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Koneksi gagal.'); } finally { setBusy(false); } }}><h2 id="reauth-title">Verifikasi kata sandi</h2><p>Verifikasi berlaku 15 menit. Setelah berhasil, konfirmasikan kembali tindakanmu.</p>{error && <Notice kind="error">{error}</Notice>}<Field label="Kata sandi saat ini" htmlFor="reauth-password"><Input autoFocus id="reauth-password" name="password" type="password" required autoComplete="current-password" /></Field><Button disabled={busy}>Verifikasi</Button><Button variant="quiet" type="button" disabled={busy} onClick={() => setOpen(false)}>Kembali</Button></form></dialog>;
}
