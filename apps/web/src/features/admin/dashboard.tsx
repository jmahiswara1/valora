'use client';

import type { ImpactDto } from '@valora/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Heading } from '../../components/ui/heading';
import { LoadState } from '../../components/ui/query-state';
import Link from 'next/link';
import { Notice } from "../../components/ui/primitives";
import { ImpactSummary } from '../impact/summary';

type Dashboard = { queues: { moderation: number; reports: number; disputes: number; corrections: number; overdue: number }; impact: ImpactDto };

const adminLinks = [{ path: 'moderasi', title: 'Review Listing', key: 'moderation' }, { path: 'laporan', title: 'Laporan pengguna', key: 'reports' }, { path: 'sengketa', title: 'Sengketa aktif', key: 'disputes' }, { path: 'transaksi', title: 'Transaksi dan koreksi', key: 'corrections' }, { path: 'pengguna', title: 'Pengguna' }, { path: 'rubrik', title: 'Kategori dan rubrik' }, { path: 'analitik', title: 'Analitik' }, { path: 'audit', title: 'Audit dan retensi' }];

export function AdminDashboardPage() {
  const result = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => api<Dashboard>('/admin/dashboard'), refetchInterval: 30000, retry: false });
  return <><Heading eyebrow="ADMIN / OPERASI" title="Operasi Valora">Tinjau antrean, penugasan kasus, dan catatan aktivitas platform.</Heading><LoadState query={result} />{result.data && <><div className="operations-list">{adminLinks.map((link) => <Link className="app-panel" href={'/app/admin/' + link.path} key={link.path}><span className="eyebrow">{link.key ? `${result.data!.queues[link.key as keyof Dashboard['queues']]} menunggu tindak lanjut` : 'Operasi admin'}</span><h2>{link.title}</h2><span className="link-button">Buka {link.title.toLowerCase()} →</span></Link>)}</div><Notice>{result.data.queues.overdue} transaksi melewati target serah terima.</Notice><section><h2>Impact seluruh waktu</h2><ImpactSummary data={result.data.impact} /></section></>}</>;
}
