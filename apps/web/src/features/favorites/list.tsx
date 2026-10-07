'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowUpRight, Heart, PackageCheck } from 'lucide-react';
import type { FavoriteDto } from '@valora/contracts';
import { useSession } from '@/lib/session';
import { apiEnvelope } from '@/lib/api';
import { Button, Notice } from '@/components/ui/primitives';
import { AccountHeading } from '../account/heading';
import { MarketCard } from '../market/card';
import { FavoriteScope } from './hooks';
import { FavoriteButton } from './button';

const date = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(new Date(value));

export function FavoritesPage() {
  const session = useSession(); const userId = session.session?.user?.id;
  const grid = useRef<HTMLDivElement>(null); const heading = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<{ listingId: string; index: number } | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const query = useInfiniteQuery({
    queryKey: ['favorites', userId, 'list'], enabled: session.state === 'AUTHENTICATED',
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => apiEnvelope<FavoriteDto[]>(`/me/favorites?${new URLSearchParams({ limit: '20', ...(pageParam ? { cursor: pageParam } : {}) })}`),
    getNextPageParam: page => page.meta?.nextCursor ?? undefined,
    refetchOnWindowFocus: true,
  });
  const rows = useMemo(() => [...new Map((query.data?.pages.flatMap(page => page.data) ?? []).map(row => [row.listingId, row])).values()], [query.data]);
  useEffect(() => {
    const target = focusTarget.current;
    if (!target || rows.some(row => row.listingId === target.listingId)) return;
    focusTarget.current = null;
    const next = grid.current?.querySelectorAll<HTMLButtonElement>('.favorite-button')[target.index];
    (next ?? heading.current)?.focus();
  }, [rows]);
  const removed = (row: FavoriteDto, index: number) => {
    focusTarget.current = { listingId: row.listingId, index }; setError('');
    setFeedback(`${row.availability === 'ACTIVE' ? row.listing.revision.title : row.savedTitle} dihapus dari Favorit.`);
  };
  return <section className="favorites-page">
    <div ref={heading} tabIndex={-1} className="favorites-heading"><AccountHeading title="Favorit" description="Simpan yang menarik. Temukan kembali saat kamu siap."
      actions={<Link className="button button-secondary" href="/market">Jelajahi Market <ArrowUpRight size={17} aria-hidden="true" /></Link>} /></div>
    <p className="favorites-note">Daftar ini hanya terlihat olehmu. Menyimpan barang tidak mereservasi atau membuat penawaran.</p>
    {feedback && <p className="favorites-result" role="status">{feedback}</p>}
    {error && <Notice kind="error">{error}</Notice>}
    {query.isPending ? <div className="favorites-catalog"><p role="status">Memuat Favorit…</p><div className="catalog-grid" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <div className="catalog-skeleton" key={index}><div /><span /><span /><span /></div>)}</div></div>
      : query.isError && !query.data ? <Notice kind="error">Favorit gagal dimuat. <button type="button" className="link-button" onClick={() => query.refetch()}>Coba lagi</button></Notice>
      : rows.length || query.hasNextPage ? <div className="favorites-catalog">
        <p className="favorites-count" role="status">{rows.length} barang dimuat</p>
        {query.isError && !query.isFetchNextPageError && <Notice kind="error">Daftar terbaru belum dapat dimuat. <button type="button" className="link-button" onClick={() => query.refetch()}>Coba lagi</button></Notice>}
        <FavoriteScope listingIds={rows.map(row => row.listingId)} knownSaved><div ref={grid} className="catalog-grid" aria-busy={query.isFetching} onFocusCapture={event => {
          const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.favorite-button') : null;
          const index = button ? Array.from(event.currentTarget.querySelectorAll('.favorite-button')).indexOf(button) : -1;
          if (button?.dataset.listingId && index >= 0) focusTarget.current = { listingId: button.dataset.listingId, index };
        }}>{rows.map((row, index) => row.availability === 'ACTIVE'
          ? <MarketCard key={row.listingId} listing={row.listing} onFavoriteRemoved={() => removed(row, index)} onFavoriteError={setError} />
          : <article className="market-card favorite-unavailable" key={row.listingId}>
            <div className="favorite-unavailable-photo"><PackageCheck size={30} strokeWidth={1.4} aria-hidden="true" /><span>{row.availability === 'RESERVED' ? 'Sedang dalam kesepakatan' : 'Tidak tersedia'}</span></div>
            <div className="market-card-content"><h3 title={row.savedTitle}>{row.savedTitle}</h3><p className="favorite-saved-label">Nama saat disimpan</p><p className="favorite-saved-date">Disimpan {date(row.savedAt)}</p>
              {row.availability === 'RESERVED' ? <Link href={`/market/${row.listingId}`} className="favorite-status-link">Lihat status</Link> : <p className="favorite-unavailable-note">Barang ini tidak lagi ditawarkan.</p>}</div>
            <FavoriteButton listingId={row.listingId} title={row.savedTitle} allowSave={false} onRemoved={() => removed(row, index)} onFailure={setError} />
          </article>)}</div></FavoriteScope>
        {query.isFetchNextPageError && <Notice kind="error">Favorit berikutnya gagal dimuat. Daftar yang sudah tampil tetap tersedia.</Notice>}
        {query.hasNextPage && <div className="catalog-load-more"><Button variant="secondary" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? 'Memuat…' : query.isFetchNextPageError ? 'Coba muat lagi' : 'Muat lebih banyak'}</Button></div>}
      </div> : <div className="favorites-empty"><Heart size={34} strokeWidth={1.4} aria-hidden="true" /><h2>Belum ada barang favorit.</h2><p>Tekan ikon hati pada barang yang menarik untuk menyimpannya di sini.</p><Link href="/market" className="button button-primary">Temukan barang <ArrowUpRight size={17} aria-hidden="true" /></Link></div>}
  </section>;
}
