'use client';

import { useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { NotificationDto } from '@valora/contracts';
import { useState } from 'react';
import { Notice, Button } from "../../components/ui/primitives";
import Link from 'next/link';

export function TransactionNotifications() {
  const cache = useQueryClient(); const rows = useQuery({ queryKey: ['notifications'], queryFn: () => api<NotificationDto[]>('/notifications'), refetchInterval: 30000 });
  const [error, setError] = useState('');
  const unread = rows.data?.filter((n) => !n.readAt) ?? [];
  async function read(id: string) { try { await api(`/notifications/${id}/read`, { method: 'POST' }); await cache.invalidateQueries({ queryKey: ['notifications'] }); } catch { setError('Pengingat belum ditandai dibaca. Coba lagi.'); } }
  return <section className="app-panel form-stack"><h2>Pengingat transaksi</h2>{error && <Notice kind="error">{error}</Notice>}{rows.isPending ? <p role="status">Memuat pengingat…</p> : rows.isError ? <Notice kind="error">Pengingat gagal dimuat.</Notice> : unread.length ? unread.map((n) => <div className="notification-row" key={n.id}><div><Link href={`/app/transaksi/${n.payload.transactionId}`}>{n.payload.title}</Link><p>Pengingat hari ke-{n.payload.day}. Periksa serah terima dan konfirmasi.</p></div><Button variant="quiet" onClick={() => read(n.id)}>Tandai dibaca</Button></div>) : <p>Tidak ada pengingat baru.</p>}<Link href="/app/transaksi" className="link-button">Lihat semua transaksi →</Link></section>;
}
