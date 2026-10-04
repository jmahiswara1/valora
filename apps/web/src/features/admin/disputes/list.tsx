'use client';

import { Select } from '@/components/ui/select';

import { useMe } from '@/lib/session';
import { useCriticalAction } from '../../../hooks/use-critical-action';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiEnvelope } from '@/lib/api';
import type { DisputeDto } from '@valora/contracts';
import { Field, Notice, Button } from "../../../components/ui/primitives";
import Link from 'next/link';
import { ActionFeedback } from '../../../components/ui/action-feedback';
import { ConfirmAction } from '../../../components/ui/confirm-dialog';

type OverdueRow = { id: string; title: string; targetHandoverAt: string; overdueAt: string; version: number };

export function DisputesQueue() {
  const me = useMe(); const action = useCriticalAction('overdue-followup', me.data?.id ?? '');
  const [status, setStatus] = useState(''); const [overdue, setOverdue] = useState<OverdueRow | null>(null); const [reason, setReason] = useState('');
  const rows = useInfiniteQuery({ queryKey: ['admin-disputes', status], initialPageParam: null as string | null, queryFn: async ({ pageParam }) => await apiEnvelope<DisputeDto[]>(`/admin/disputes?limit=20${status ? '&status=' + status : ''}${pageParam ? '&cursor=' + encodeURIComponent(pageParam) : ''}`) as { data: DisputeDto[]; meta: { nextCursor: string | null; overdue: OverdueRow[] } }, getNextPageParam: (p) => p.meta.nextCursor ?? undefined, refetchInterval: 10000 });
  const all = rows.data?.pages.flatMap((p) => p.data) ?? [];
  return <><div className="app-heading"><div><span className="eyebrow">ADMIN / KESEPAKATAN</span><h1>Sengketa dan tindak lanjut</h1><p>Ambil penugasan sebelum memeriksa bukti atau membuat putusan.</p></div></div><Field label="Status kasus" htmlFor="case-status"><Select className="select" id="case-status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Kasus terbuka</option><option value="OPEN">Belum ditugaskan</option><option value="IN_REVIEW">Dalam pemeriksaan</option><option value="RESOLVED">Selesai</option></Select></Field>
    {rows.isPending ? <p role="status">Memuat antrean…</p> : rows.isError ? <Notice kind="error">Antrean tidak dapat dibuka. <Button variant="quiet" onClick={() => rows.refetch()}>Coba lagi</Button></Notice> : all.length ? <div className="transaction-list">{all.map((r) => <Link className="transaction-row" key={r.id} href={`/app/admin/sengketa/${r.id}`}><div><h2>{r.transactionTitle}</h2><p>Kasus {r.id.slice(0, 8)} · {r.assignedAdminId ? 'Sudah ditugaskan' : 'Belum ditugaskan'}</p></div><span className="badge">{r.status === 'OPEN' ? 'Terbuka' : r.status === 'IN_REVIEW' ? 'Dalam pemeriksaan' : 'Selesai'}</span></Link>)}</div> : <div className="empty-state"><h2>Tidak ada kasus pada filter ini.</h2></div>}{rows.hasNextPage && <Button variant="secondary" onClick={() => rows.fetchNextPage()}>Muat kasus berikutnya</Button>}
    <section className="app-panel form-stack"><h2>Target serah terima terlewati</h2><p>Waktu terlewati tidak mengubah kepemilikan. Buka kasus untuk mencatat pemeriksaan.</p>{rows.data?.pages[0].meta.overdue.length ? rows.data.pages[0].meta.overdue.map((r) => <div key={r.id} className="notification-row"><div><strong>{r.title}</strong><p>Target {new Date(r.targetHandoverAt).toLocaleDateString('id-ID')}</p></div><Button variant="secondary" onClick={() => { setOverdue(r); setReason(''); }}>Buka tindak lanjut</Button></div>) : <p>Belum ada transaksi terlambat yang memerlukan tindak lanjut.</p>}<ActionFeedback action={action} /></section>
    {overdue && <ConfirmAction title={'Tindak lanjut: ' + overdue.title} buttonLabel="Buka kasus dan ambil penugasan" pending={action.pending} onClose={() => setOverdue(null)} onConfirm={async () => { const result = await action.run(`/admin/transactions/${overdue.id}/open-case`, { expectedVersion: overdue.version, reason: reason.trim() }); if (result) setOverdue(null); }}><p>Kasus membekukan penyelesaian otomatis sampai putusan admin.</p><Field label="Alasan tindak lanjut" htmlFor="overdue-reason"><textarea id="overdue-reason" className="textarea" required minLength={5} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></Field><ActionFeedback action={action} onRecovered={() => setOverdue(null)} /></ConfirmAction>}
  </>;
}
