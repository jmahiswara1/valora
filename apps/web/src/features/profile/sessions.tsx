'use client';

import { useSession } from '@/lib/session';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiEnvelope, api } from '@/lib/api';
import type { ActiveSessionDto } from '@valora/contracts';
import { Notice, Button } from "../../components/ui/primitives";
import { dateTime } from '../../lib/date';
import { ConfirmAction } from '../../components/ui/confirm-dialog';

export function SessionManagement() {
  const session = useSession(); const [target, setTarget] = useState<string | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const result = useInfiniteQuery({ queryKey: ['sessions'], initialPageParam: null as string | null, queryFn: ({ pageParam }) => apiEnvelope<ActiveSessionDto[]>('/me/sessions' + (pageParam ? '?cursor=' + pageParam : '')), getNextPageParam: (p) => p.meta?.nextCursor ?? undefined });
  return <section className="form-stack account-session-list"><h2>Sesi aktif</h2><p>Sesi berakhir tujuh hari sejak login. Waktu aktivitas diperbarui paling sering setiap lima menit.</p>{result.isError && <Notice kind="error">Sesi gagal dimuat. <Button variant="quiet" onClick={() => result.refetch()}>Coba lagi</Button></Notice>}{result.isPending && <p role="status">Memuat sesi…</p>}{result.data?.pages.flatMap((p) => p.data).map((row) => <article key={row.id}><strong>{row.current ? 'Sesi saat ini' : 'Sesi lain'} · {row.id.slice(0, 8)}</strong><p className="meta">Masuk {dateTime(row.createdAt)}<br />Aktivitas {dateTime(row.lastSeenAt)}<br />Berakhir {dateTime(row.expiresAt)}</p><Button variant="quiet" onClick={() => setTarget(row.id)}>Cabut sesi</Button></article>)}{result.hasNextPage && <Button variant="quiet" disabled={result.isFetchingNextPage} onClick={() => result.fetchNextPage()}>Muat sesi berikutnya</Button>}<Button variant="secondary" onClick={() => setTarget('others')}>Cabut semua sesi lain</Button>{target && <ConfirmAction title="Cabut sesi" buttonLabel="Cabut sesi" pending={busy} onClose={() => setTarget(null)} onConfirm={async () => { setBusy(true); setError(''); try { await api(target === 'others' ? '/me/sessions/revoke-others' : '/me/sessions/' + target, { method: target === 'others' ? 'POST' : 'DELETE' }); setTarget(null); await result.refetch(); await session.changed(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Koneksi gagal.'); } finally { setBusy(false); } }}><p>Sesi yang dicabut langsung kehilangan akses.</p>{error && <Notice kind="error">{error}</Notice>}</ConfirmAction>}</section>;
}
