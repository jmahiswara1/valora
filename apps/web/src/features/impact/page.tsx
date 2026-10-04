'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ImpactDto } from '@valora/contracts';
import { RecordItemLink } from '../../components/ui/public-actions';
import { periodQuery } from './period';
import { PeriodPicker } from './period-picker';
import { LoadState } from '../../components/ui/query-state';
import { ImpactSummary } from './summary';
import { Heading } from '../../components/ui/heading';

export function ImpactPage({ publicView = false }: { publicView?: boolean }) {
  const [days, setDays] = useState(publicView ? 'all' : '30');
  const result = useQuery({ queryKey: ['impact', publicView, days], queryFn: () => api<ImpactDto>((publicView ? '/impact/public' : '/me/impact') + periodQuery(days)) });
  if (publicView) return <div className="public-impact">
    <header className="public-impact-header"><h1>Langkah kecil.<br />Cerita yang terus berlanjut.</h1><p>Catatan sirkularitas bersama, dari barang yang dinilai ulang, perbaikan, dan transfer yang tercatat di Valora.</p></header>
    <section aria-labelledby="impact-metrics-heading">
      <div className="impact-toolbar"><div><h2 id="impact-metrics-heading">Kontribusi yang tercatat.</h2><p>Lima metrik, bersumber dari aktivitas di platform.</p></div><PeriodPicker value={days} onChange={setDays} /></div>
      <LoadState query={result} />
      {result.data && <ImpactSummary data={result.data} />}
    </section>
    <section className="public-closing" aria-labelledby="impact-closing-heading"><div><h2 id="impact-closing-heading">Barangmu bisa ikut bercerita.</h2><p>Mulai dengan mencatat satu barang, lalu pilih langkah berikutnya.</p></div><RecordItemLink /></section>
  </div>;
  return <><Heading eyebrow={publicView ? 'VALORA / IMPACT' : 'AKUN / IMPACT SAYA'} title={publicView ? 'Catatan sirkularitas bersama.' : 'Kontribusi yang kamu catat.'}>Lima metrik dari penilaian, perbaikan, dan transfer yang tercatat.</Heading><div className="impact-period"><PeriodPicker value={days} onChange={setDays} /></div><LoadState query={result} skeleton />{result.data && <ImpactSummary data={result.data} />}</>;
}
