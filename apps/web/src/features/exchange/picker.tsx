'use client';

import { useId } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { ExchangeCandidateDto, TransactionItemSnapshot } from '@valora/contracts';
import Link from 'next/link';
import { apiEnvelope } from '@/lib/api';
import { Button, Notice } from '@/components/ui/primitives';
import { PrivatePhoto } from '@/features/items/photo';

export function ExchangePicker({ listingId, selected, onChange, anchorId, snapshots = [], focusRef }: {
  listingId: string; selected: string[]; onChange: (ids: string[]) => void; anchorId?: string; snapshots?: TransactionItemSnapshot[]; focusRef?: (element: HTMLFieldSetElement | null) => void;
}) {
  const id = useId();
  const query = useInfiniteQuery({ queryKey: ['exchange-candidates', listingId], initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => apiEnvelope<ExchangeCandidateDto[]>(`/listings/${listingId}/exchange-candidates?limit=20${pageParam ? '&cursor=' + encodeURIComponent(pageParam) : ''}`),
    getNextPageParam: page => page.meta?.nextCursor ?? undefined, retry: false, refetchOnWindowFocus: false });
  const rows = query.data?.pages.flatMap(page => page.data) ?? [];
  const missing = snapshots.filter(item => selected.includes(item.id) && !rows.some(row => row.item.id === item.id));
  function choose(itemId: string) { onChange(selected.includes(itemId) ? selected.filter(value => value !== itemId) : [...selected, itemId]); }
  return <fieldset className="exchange-picker" tabIndex={-1} ref={focusRef} aria-describedby={id + '-hint'}><legend>Barang milikmu <span className="meta">{selected.length}/3 dipilih</span></legend><p id={id + '-hint'} className="field-hint">Pilih 1–3 barang yang memenuhi syarat Exchange.{anchorId && ' Barang utama Listing wajib disertakan.'}</p>
    {missing.length > 0 && <div className="exchange-selected">{missing.map(item => <div key={item.id}><strong>{item.title}</strong>{item.id === anchorId ? <span className="meta">Barang utama</span> : <Button type="button" variant="quiet" onClick={() => choose(item.id)}>Lepas pilihan</Button>}</div>)}</div>}
    {query.isPending ? <p role="status">Memuat barangmu…</p> : !rows.length && !query.isError ? <p>Belum ada barang untuk dipilih. <Link href="/app/barang/baru">Catat barangmu dahulu</Link>.</p> : <div className="exchange-candidates">{rows.map(({ item, eligible, reason }) => <label className="exchange-candidate" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} disabled={item.id === anchorId || !eligible && !selected.includes(item.id) || selected.length >= 3 && !selected.includes(item.id)} onChange={() => choose(item.id)} /><PrivatePhoto mediaId={item.media[0]?.id} alt={'Foto ' + item.title} /><span><strong>{item.title}</strong><small>{item.id === anchorId ? 'Barang utama · wajib disertakan' : !eligible ? reason : 'Siap ditawarkan untuk Exchange'}</small></span></label>)}</div>}
    {query.isError && <Notice kind="error">Barang belum dapat dimuat. <Button type="button" variant="quiet" disabled={query.isFetching} onClick={() => query.isFetchNextPageError ? query.fetchNextPage() : query.refetch()}>Coba lagi</Button></Notice>}
    {query.hasNextPage && <Button type="button" variant="quiet" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? 'Memuat…' : 'Muat barang lainnya'}</Button>}
    {selected.length >= 3 && <p className="field-hint" role="status">Tiga barang sudah dipilih. Lepas salah satu pilihan untuk menggantinya.</p>}
  </fieldset>;
}
