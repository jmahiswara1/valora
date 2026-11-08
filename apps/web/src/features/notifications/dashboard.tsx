'use client';

import Link from 'next/link';
import { Bell, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { NotificationCenterDto } from '@valora/contracts';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { AccountSkeleton } from '@/features/account/skeleton';
import { AccountError } from '@/features/account/error';
import { NotificationRow } from './row';

export function DashboardNotifications() {
  const userId = useSession().session?.user?.id;
  const rows = useQuery({ queryKey: ['notification-center', userId, 'dashboard'], queryFn: () => api<NotificationCenterDto[]>('/me/notifications?status=unread&limit=3'), enabled: Boolean(userId), refetchInterval: 30000, refetchOnWindowFocus: true });
  return <section className="dashboard-notifications" aria-labelledby="dashboard-notifications"><div className="dashboard-news-heading"><div className="dashboard-section-title"><Bell size={20} aria-hidden="true" /><h2 id="dashboard-notifications">Kabar terbaru</h2></div></div>
    {rows.isPending ? <AccountSkeleton /> : rows.isError ? <AccountError retry={() => rows.refetch()}>Notifikasi gagal dimuat.</AccountError> : rows.data?.length ? <ul className="dashboard-news-list">{rows.data.map(row => <NotificationRow key={row.id} row={row} compact />)}</ul> : <div className="dashboard-empty dashboard-news-empty"><Bell size={21} aria-hidden="true" /><div><strong>Belum ada kabar baru.</strong><p>Perkembangan penawaran dan transaksi akan muncul di sini.</p></div></div>}
    <Link className="dashboard-news-footer" href="/app/notifikasi">Lihat semua notifikasi <ChevronRight size={15} aria-hidden="true" /></Link>
  </section>;
}
