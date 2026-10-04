'use client';

import type { ImpactDto } from '@valora/contracts';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { periodQuery } from '../impact/period';
import { Heading } from '../../components/ui/heading';
import { PeriodPicker } from '../impact/period-picker';
import { LoadState } from '../../components/ui/query-state';
import { ImpactSummary } from '../impact/summary';

type Analytics = { impact: ImpactDto; transactionCompletion: { numerator: number; denominator: number; value: number | null; definition: string }; moderationApproval: { numerator: number; denominator: number; value: number | null; definition: string } };

export function AdminAnalyticsPage() {
  const [days, setDays] = useState('30'); const result = useQuery({ queryKey: ['admin-analytics', days], queryFn: () => api<Analytics>('/admin/analytics' + periodQuery(days)) });
  return <><Heading eyebrow="ADMIN / ANALITIK" title="Aktivitas platform">Periode, pembilang, dan penyebut ditampilkan bersama hasilnya.</Heading><PeriodPicker value={days} onChange={setDays} /><LoadState query={result} />{result.data && <><div className="operations-list">{([{ title: 'Penyelesaian transaksi', data: result.data.transactionCompletion }, { title: 'Persetujuan moderasi', data: result.data.moderationApproval }]).map(({ title, data }) => <section className="app-panel" key={title}><h2>{title}</h2><strong className="analytics-value">{data.value === null ? 'Belum tersedia' : new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits: 1 }).format(data.value)}</strong><p>{data.numerator} / {data.denominator}</p><p className="muted">{data.definition}</p></section>)}</div><ImpactSummary data={result.data.impact} /></>}</>;
}
