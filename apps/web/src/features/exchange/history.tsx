'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { OfferRevisionDto } from '@valora/contracts';
import { apiEnvelope } from '@/lib/api';
import { Button, Notice } from '@/components/ui/primitives';
import { ExchangeTermsView } from './terms';
import { money } from '@/features/market/process-shared';

export function OfferHistory({ id, version }: { id: string; version: number }) {
  const [open, setOpen] = useState(false);
  const query = useInfiniteQuery({ queryKey: ['offers', 'history', id, version], enabled: open, initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => apiEnvelope<OfferRevisionDto[]>(`/offers/${id}/revisions?limit=10${pageParam ? '&cursor=' + encodeURIComponent(pageParam) : ''}`), getNextPageParam: page => page.meta?.nextCursor ?? undefined, retry: false });
  const rows = query.data?.pages.flatMap(page => page.data) ?? [];
  return <details className="exchange-history" onToggle={event => setOpen(event.currentTarget.open)}><summary>Riwayat penawaran</summary>{query.isPending ? <p role="status">Memuat revisi…</p> : <>{rows.map((row, index) => {
    const older = rows[index + 1], compareItems = row.exchangeTerms && older?.exchangeTerms;
    const currentIds = row.exchangeTerms ? [...row.exchangeTerms.ownerItems, ...row.exchangeTerms.bidderItems].map(item => item.id) : [];
    const previousIds = older?.exchangeTerms ? [...older.exchangeTerms.ownerItems, ...older.exchangeTerms.bidderItems].map(item => item.id) : [];
    const added = currentIds.filter(id => !previousIds.includes(id)).length, removed = previousIds.filter(id => !currentIds.includes(id)).length;
    const cashChanged = older && JSON.stringify(row.exchangeTerms?.cashAdjustment) !== JSON.stringify(older.exchangeTerms?.cashAdjustment);
    return <section className="exchange-revision" key={row.id}><h3>Revisi {row.revisionNo}</h3><p className="meta">{new Date(row.createdAt).toLocaleString('id-ID')}{compareItems && ` · ${added} barang ditambahkan, ${removed} dilepas${cashChanged ? ' · tambahan uang berubah' : ''}`}</p>{row.exchangeTerms ? <ExchangeTermsView terms={row.exchangeTerms} /> : <p>{row.priceIdr ? money(row.priceIdr) : 'Tanpa nominal'}</p>}{row.message && <p className="preserve-lines">{row.message}</p>}</section>;
  })}{!rows.length && !query.isError && <p>Belum ada riwayat revisi.</p>}</>}{query.isError && <Notice kind="error">Riwayat belum dapat dimuat. <Button type="button" variant="quiet" disabled={query.isFetching} onClick={() => query.isFetchNextPageError ? query.fetchNextPage() : query.refetch()}>Coba lagi</Button></Notice>}{query.hasNextPage && <Button type="button" variant="secondary" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Muat revisi sebelumnya</Button>}</details>;
}
