'use client';

import { Select } from '@/components/ui/select';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiEnvelope } from '@/lib/api';
import type { TransactionDto } from '@valora/contracts';
import { Field, Notice, Button } from "../../components/ui/primitives";
import { AccountSkeleton } from '../account/skeleton';
import Link from 'next/link';
import { transactionLabels } from './labels';
import { time, money } from './shared';

export function TransactionsPage() {
  const [status, setStatus] = useState('');
  const rows = useInfiniteQuery({ queryKey: ['transactions', status], initialPageParam: null as string | null, queryFn: ({ pageParam }) => apiEnvelope<TransactionDto[]>(`/me/transactions?limit=20${status ? '&status=' + status : ''}${pageParam ? '&cursor=' + encodeURIComponent(pageParam) : ''}`), getNextPageParam: (page) => page.meta?.nextCursor ?? undefined, refetchInterval: 10000 });
  const all = rows.data?.pages.flatMap((p) => p.data) ?? [];
  return <><div className="app-heading"><div><span className="eyebrow">AKUN / KESEPAKATAN</span><h1>Transaksi</h1><p>Kesepakatan, serah terima, dan riwayat barang yang berpindah.</p></div></div><div className="transaction-filter"><Field label="Status transaksi" htmlFor="transaction-filter"><Select id="transaction-filter" className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua status</option>{Object.entries(transactionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field></div>
    {rows.isPending ? <AccountSkeleton /> : rows.isError && !all.length ? <Notice kind="error">Transaksi gagal dimuat. <Button variant="quiet" onClick={() => rows.refetch()}>Coba lagi</Button></Notice> : all.length ? <div className="transaction-list">{all.map((r) => <Link key={r.id} href={`/app/transaksi/${r.id}`} className="transaction-row"><div><span className="eyebrow">{r.type}</span><h2>{r.snapshot.items[0].title}</h2><p>{r.confirmations.length}/{r.requiredConfirmations.length} konfirmasi · Target {time(r.targetHandoverAt)}</p></div><div><span className="badge">{transactionLabels[r.status]}</span>{r.overdueAt && !['COMPLETED', 'CANCELLED'].includes(r.status) && <span className="badge badge-warn">Terlambat</span>}{r.finalPriceIdr !== null && <strong>{money(r.finalPriceIdr)}</strong>}</div></Link>)}</div> : <div className="empty-state"><h2>Belum ada transaksi.</h2><p>Kesepakatan muncul setelah revisi Offer diterima.</p><Link href="/app/penawaran" className="button button-secondary">Lihat penawaran</Link></div>}
    {rows.isFetchNextPageError && <Notice kind="error">Transaksi berikutnya belum dimuat. Daftar sebelumnya tetap tersedia.</Notice>}{rows.hasNextPage && <Button variant="secondary" disabled={rows.isFetchingNextPage} onClick={() => rows.fetchNextPage()}>{rows.isFetchingNextPage ? 'Memuat…' : rows.isFetchNextPageError ? 'Coba muat lagi' : 'Muat transaksi berikutnya'}</Button>}</>;
}
