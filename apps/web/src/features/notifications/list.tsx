'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, ArrowUpRight } from 'lucide-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { NotificationCenterDto, NotificationsQuery } from '@valora/contracts';
import { apiEnvelope } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Button } from '@/components/ui/primitives';
import { AccountError } from '@/features/account/error';
import { AccountSkeleton } from '@/features/account/skeleton';
import { useNotificationRead, useNotificationSummary } from './hooks';
import { NotificationRow } from './row';

export function NotificationsPage() {
  const userId = useSession().session?.user?.id, summary = useNotificationSummary();
  const [status, setStatus] = useState<NotificationsQuery['status']>('all'), [category, setCategory] = useState<NotificationsQuery['category']>('all');
  const { read, pending } = useNotificationRead();
  const list = useRef<HTMLUListElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const focus = useRef<{ id: string; index: number } | null>(null);
  const rowsQuery = useInfiniteQuery({ queryKey: ['notification-center', userId, 'list', status, category], initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => apiEnvelope<NotificationCenterDto[]>(`/me/notifications?${new URLSearchParams({ status, category, limit: '20', ...(pageParam ? { cursor: pageParam } : {}) })}`),
    getNextPageParam: page => page.meta?.nextCursor ?? undefined, enabled: Boolean(userId), refetchInterval: 30000, refetchOnWindowFocus: true, refetchOnReconnect: true });
  const rows = useMemo(() => [...new Map(rowsQuery.data?.pages.flatMap(page => page.data).map(row => [row.id, row])).values()].filter(row => status !== 'unread' || !row.readAt), [rowsQuery.data, status]);
  useEffect(() => {
    const target = focus.current;
    if (!target || rows.some(row => row.id === target.id)) return;
    focus.current = null;
    const next = list.current?.querySelectorAll<HTMLAnchorElement>('.notification-entry-link')[Math.min(target.index, rows.length - 1)];
    (next ?? heading.current)?.focus();
  }, [rows]);
  function chooseStatus(value: typeof status) { focus.current = null; setStatus(value); }
  return <div className="notifications-page">
    <div className="notifications-heading"><div><span className="notification-eyebrow">Aktivitas akun</span><h1 ref={heading} tabIndex={-1}>Notifikasi</h1><p>Ikuti barang yang kamu cari, pesan, penawaran, dan perkembangan transaksi.</p></div><Button variant="secondary" disabled={pending || summary.isError || !summary.data?.unreadCount} onClick={() => { if (status === 'unread' && rows[0]) focus.current = { id: rows[0].id, index: 0 }; read('all'); }}><CheckCheck size={18} aria-hidden="true" />{pending ? 'Menandai…' : 'Tandai semua dibaca'}</Button></div>
    <div className="notification-filters"><div className="notification-status-filters" role="group" aria-label="Status notifikasi">{(['all', 'unread'] as const).map(value => <button type="button" key={value} aria-pressed={status === value} onClick={() => chooseStatus(value)}>{value === 'all' ? 'Semua' : 'Belum dibaca'}{value === 'unread' && !summary.isError && summary.data && <span>{summary.data.unreadCount > 99 ? '99+' : summary.data.unreadCount}</span>}</button>)}</div>
      <div className="notification-category-filters" role="group" aria-label="Kategori notifikasi">{(['all', 'offers', 'transactions', 'market', 'messages'] as const).map(value => <button type="button" key={value} aria-pressed={category === value} onClick={() => { focus.current = null; setCategory(value); }}>{value === 'all' ? 'Semua aktivitas' : value === 'offers' ? 'Penawaran' : value === 'market' ? 'Market' : value === 'messages' ? 'Pesan' : 'Transaksi'}</button>)}</div></div>
    {summary.isError && <AccountError retry={() => summary.refetch()}>Jumlah belum dibaca gagal dimuat.</AccountError>}
    {rowsQuery.isPending ? <AccountSkeleton /> : rowsQuery.isError && !rowsQuery.data ? <AccountError retry={() => rowsQuery.refetch()}>Notifikasi gagal dimuat.</AccountError> : rows.length || rowsQuery.hasNextPage ? <>
      <ul className="notification-list" ref={list}>{rows.map((row, index) => <NotificationRow key={row.id} row={row} onRead={() => { if (status === 'unread') focus.current = { id: row.id, index }; }} />)}</ul>
      {rowsQuery.isError && !rowsQuery.isFetchNextPageError && <AccountError retry={() => rowsQuery.refetch()}>Pembaruan notifikasi gagal. Hasil sebelumnya tetap ditampilkan.</AccountError>}
      {rowsQuery.hasNextPage && <div className="notification-pagination">{rowsQuery.isFetchNextPageError && <p role="alert">Notifikasi berikutnya gagal dimuat. Coba lagi.</p>}<Button variant="secondary" disabled={rowsQuery.isFetching} onClick={() => rowsQuery.fetchNextPage()}>{rowsQuery.isFetchingNextPage ? 'Memuat…' : rowsQuery.isFetchNextPageError ? 'Coba lagi' : 'Muat lebih banyak'}</Button></div>}
    </> : <div className="notifications-empty"><span><Bell size={30} strokeWidth={1.5} aria-hidden="true" /></span><h2>{status === 'unread' ? category === 'all' ? 'Semua kabar sudah kamu baca.' : 'Tidak ada kabar baru di kategori ini.' : category !== 'all' ? 'Belum ada aktivitas di kategori ini.' : 'Belum ada notifikasi.'}</h2><p>{status === 'unread' ? 'Notifikasi baru akan muncul saat ada perkembangan.' : 'Kabar pencarian, pesan, penawaran, dan transaksi akan terkumpul di sini.'}</p><Link href="/market" className="button button-secondary">Jelajahi Market <ArrowUpRight size={16} aria-hidden="true" /></Link></div>}
  </div>;
}
