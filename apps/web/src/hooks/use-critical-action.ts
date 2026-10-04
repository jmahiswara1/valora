'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { actionOperationFor, type ActionStatusDto } from '@valora/contracts';
import { api, ApiClientError } from '@/lib/api';

type Intent = { actorId: string; operation: string; key: string };

export function useCriticalAction(scope: string, actorId: string) {
  const cache = useQueryClient();
  const [pending, setPending] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [notFound, setNotFound] = useState(false);
  const running = useRef(false);
  const slot = 'valora-action:' + actorId + ':' + scope;
  useEffect(() => {
    let active = true;
    if (sessionStorage.getItem(slot)) {
      queueMicrotask(() => { if (active) setError('Ada tindakan sebelumnya yang belum pasti. Periksa status tindakan.'); });
    }
    return () => { active = false; };
  }, [slot]);
  function saved(): Intent | null {
    try { return JSON.parse(sessionStorage.getItem(slot) ?? 'null') as Intent | null; } catch { return null; }
  }
  async function run<T>(path: string, body: unknown): Promise<T | undefined> {
    if (running.current) return;
    const old = saved();
    if (old) { setError('Hasil tindakan sebelumnya belum pasti. Periksa status sebelum mengirim tindakan lain.'); return; }
    const intent = { actorId, operation: actionOperationFor(path, body), key: crypto.randomUUID() };
    sessionStorage.setItem(slot, JSON.stringify(intent)); running.current = true; setPending(true); setError(''); setNotice('');
    try {
      const result = await api<T>(path, { method: 'POST', body, headers: { 'Idempotency-Key': intent.key } });
      sessionStorage.removeItem(slot); setNotice('Tindakan tersimpan. Status diperbarui dari server.');
      await cache.invalidateQueries(); return result;
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status < 500 && !['SESSION_CHANGED', 'UNAUTHENTICATED'].includes(cause.code)) {
        sessionStorage.removeItem(slot); setError(cause.message); await cache.invalidateQueries();
      } else setError('Hasil tindakan belum dapat dipastikan. Periksa status tindakan.');
      return undefined;
    } finally { running.current = false; setPending(false); }
  }
  async function retry() {
    if (running.current) return;
    const old = saved(); if (!old || old.actorId !== actorId) return;
    running.current = true; setPending(true); setError('');
    try {
      const result = await api<ActionStatusDto>('/me/actions/status', { method: 'POST', body: { operation: old.operation, key: old.key } });
      if (result.status === 'NOT_FOUND') { setNotFound(true); setError('Tindakan belum tercatat. Hasil masih belum pasti; periksa status resource sebelum mengirim tindakan baru.'); return; }
      sessionStorage.removeItem(slot); setNotice(result.status === 'PURGED' ? 'Tindakan sudah diproses. Isi historis telah dihapus sesuai retensi.' : 'Tindakan sudah tersimpan. Muat status terbaru dari server.'); await cache.invalidateQueries(); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Koneksi gagal.'); } finally { running.current = false; setPending(false); }
  }
  return { run, retry, pending, error, notice, notFound, forget: () => { sessionStorage.removeItem(slot); setNotFound(false); setError(''); setNotice('Pemeriksaan ditutup setelah status diperiksa. Tindakan berikutnya memerlukan konfirmasi baru.'); }, hasSaved: () => Boolean(saved()) };
}
