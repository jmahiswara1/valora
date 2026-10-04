'use client';

import { Select } from '@/components/ui/select';

import { useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiEnvelope } from '@/lib/api';
import { useQueue, QueueMore } from '@/lib/queue';
import { Field, Input, Button, Notice } from "../../../components/ui/primitives";
import { dateTime } from '../../../lib/date';
import { ReasonField } from '../../../components/ui/reason-field';
import { CriticalButton } from '../../../components/ui/critical-button';
import type { CorrectionMeta } from '../../corrections/types';
import { Heading } from '../../../components/ui/heading';
import { LoadState } from '../../../components/ui/query-state';

type AdminTransaction = { id: string; itemId: string; type: string; status: string; version: number; acceptedAt: string; completedAt: string | null; correctedAt: string | null };

function TransactionAdminRow({ row }: { row: AdminTransaction }) { const [reason, setReason] = useState(''); return <article className="app-panel"><span className="eyebrow">{row.type} · {row.status}{row.correctedAt ? ' · dikoreksi' : ''}</span><h2>Transaksi {row.id.slice(0, 8)}</h2><p>Disepakati {dateTime(row.acceptedAt)}</p><Link href={`/passport/${row.itemId}`}>Passport barang →</Link>{row.status === 'COMPLETED' && !row.correctedAt && <details className="operations-detail"><summary>Buka kasus koreksi</summary><div className="form-stack"><ReasonField id={'correction-open-' + row.id} value={reason} onChange={setReason} /><CriticalButton path={`/transactions/${row.id}/corrections`} body={{ expectedVersion: row.version, reason }} title="Buka kasus koreksi" description="Tindakan ini membuka peninjauan atas riwayat transaksi yang sudah selesai." disabled={reason.trim().length < 5}>Buka kasus</CriticalButton></div></details>}</article>; }

export function AdminTransactionsPage() {
  const [status, setStatus] = useState(''); const [q, setQ] = useState(''); const [draftQ, setDraftQ] = useState('');
  const result = useInfiniteQuery({ queryKey: ['admin-transactions', status, q], initialPageParam: null as string | null, queryFn: ({ pageParam }) => apiEnvelope<AdminTransaction[]>(`/admin/transactions?status=${status}&q=${encodeURIComponent(q)}${pageParam ? '&cursor=' + encodeURIComponent(pageParam) : ''}`), getNextPageParam: (p) => p.meta?.nextCursor ?? undefined });
  const cases = useQueue<CorrectionMeta>(['correction-cases'], '/admin/correction-cases');
  const rows = result.data?.pages.flatMap((p) => p.data) ?? [];
  return <><Heading eyebrow="ADMIN / TRANSAKSI" title="Transaksi dan koreksi">Pantau kesepakatan serta peninjauan riwayat yang sudah selesai.</Heading><section className="app-panel"><h2>Kasus koreksi</h2><LoadState query={cases} />{cases.data?.length ? <ul className="operations-links">{cases.data.map((c) => <li key={c.id}><Link href={`/app/admin/koreksi/${c.id}`}>Kasus {c.id.slice(0, 8)} · {c.status}</Link></li>)}</ul> : cases.data && <p>Belum ada kasus koreksi.</p>}</section><form className="operations-filters" onSubmit={(e) => { e.preventDefault(); setQ(draftQ); }}><Field label="Cari judul yang dipublikasikan" htmlFor="transactions-search"><Input id="transactions-search" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} /></Field><Field label="Status transaksi" htmlFor="admin-transactions-status"><Select id="admin-transactions-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua</option>{['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED', 'DISPUTED', 'CANCELLED', 'COMPLETED'].map((s) => <option key={s}>{s}</option>)}</Select></Field><Button type="submit">Cari</Button></form><LoadState query={result} /><div className="operations-list">{rows.map((row) => <TransactionAdminRow key={row.id} row={row} />)}</div>{result.data && !rows.length && <Notice>Tidak ada transaksi sesuai filter.</Notice>}{result.hasNextPage && <Button disabled={result.isFetchingNextPage} onClick={() => result.fetchNextPage()}>Muat transaksi berikutnya</Button>}<QueueMore query={cases} /></>;
}
