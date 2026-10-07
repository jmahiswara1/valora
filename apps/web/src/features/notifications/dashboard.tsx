'use client';

import Link from 'next/link';
import { Bell, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { NotificationCenterDto } from '@valora/contracts';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { AccountSkeleton } from '@/features/account/skeleton';
import { AccountError } from '@/features/account/error';
import { useNotificationRead, notificationHref } from './hooks';

export function DashboardNotifications() {
  const userId = useSession().session?.user?.id, { read } = useNotificationRead();
  const rows = useQuery({ queryKey: ['notification-center', userId, 'dashboard'], queryFn: () => api<NotificationCenterDto[]>('/me/notifications?status=unread&limit=3'), enabled: Boolean(userId), refetchInterval: 30000, refetchOnWindowFocus: true });
  return <section className="account-activity" aria-labelledby="dashboard-notifications"><div className="account-activity-heading"><h2 id="dashboard-notifications">Kabar terbaru</h2><Bell size={19} aria-hidden="true" /></div>
    {rows.isPending ? <AccountSkeleton /> : rows.isError ? <AccountError retry={() => rows.refetch()}>Notifikasi gagal dimuat.</AccountError> : rows.data?.length ? <ul>{rows.data.map(row => <li key={row.id}><Link href={notificationHref(row)} onClick={() => read(row.id)}><strong>{row.title}</strong><small>{row.itemTitle}</small></Link></li>)}</ul> : <p>Belum ada kabar baru. Perkembangan penawaran dan transaksi akan muncul di sini.</p>}
    <Link className="account-activity-footer" href="/app/notifikasi">Lihat semua notifikasi <ChevronRight size={15} aria-hidden="true" /></Link>
  </section>;
}
