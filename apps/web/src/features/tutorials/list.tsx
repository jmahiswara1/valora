'use client';

import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { TutorialState } from '@valora/contracts';
import { BookOpen, ArrowUpRight } from 'lucide-react';
import { apiEnvelope } from '@/lib/api';
import { Button } from '@/components/ui/primitives';
import { AccountSkeleton } from '@/features/account/skeleton';
import { AccountError } from '@/features/account/error';
import { kindLabel, stateLabels } from './shared';

interface SessionSummary { id: string; itemId: string; itemTitle: string; title: string; activityKind: string; state: TutorialState; completedSteps: number; totalSteps: number; createdAt: string; recordId: string | null }
export function TutorialList() {
  const [state, setState] = useState('active');
  const query = useInfiniteQuery({ queryKey: ['tutorial-mine', state], initialPageParam: '', queryFn: ({ pageParam }) => apiEnvelope<SessionSummary[]>(`/repair-tutorial-sessions/mine?state=${state}${pageParam ? '&cursor=' + pageParam : ''}`), getNextPageParam: last => last.meta?.nextCursor ?? undefined });
  return <div className="tutorial-page"><header className="account-page-heading"><div><h1>Panduan saya.</h1><p>Progres kecil untuk menjaga barang tetap berguna.</p></div><Link className="button button-secondary" href="/app/barang">Pilih barang</Link></header><nav className="tutorial-tabs" aria-label="Filter panduan">{[['active', 'Belum ditutup'], ['closed', 'Riwayat'], ['', 'Semua']].map(([value, label]) => <Button key={value} variant={state === value ? 'primary' : 'quiet'} aria-pressed={state === value} onClick={() => setState(value)}>{label}</Button>)}</nav>
    {query.isPending ? <AccountSkeleton /> : query.error ? <AccountError retry={() => void query.refetch()}>Daftar panduan gagal dimuat.</AccountError> : <><div className="tutorial-session-list">{query.data.pages.flatMap(p => p.data).map(s => <Link href={'/app/panduan/' + s.id} key={s.id} className="tutorial-session-row"><BookOpen size={24} strokeWidth={1.6} aria-hidden="true" /><div><span className="muted">{s.itemTitle} · {kindLabel(s.activityKind)}</span><h2>{s.title}</h2><p>{s.completedSteps} dari {s.totalSteps} langkah · {stateLabels[s.state]}</p></div><ArrowUpRight size={20} aria-hidden="true" /></Link>)}</div>{!query.data.pages[0].data.length && <section className="account-empty"><BookOpen size={30} aria-hidden="true" /><h2>{state === 'closed' ? 'Belum ada riwayat panduan.' : 'Belum ada panduan di sini.'}</h2><p>Pilih barangmu untuk melihat panduan perawatan dan perbaikan yang sesuai.</p><Link className="button button-primary" href="/app/barang">Lihat barang saya</Link></section>}{query.hasNextPage && <Button variant="secondary" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Muat panduan lainnya</Button>}</>}
  </div>;
}
