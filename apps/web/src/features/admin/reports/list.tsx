'use client';

import { useQueue, QueueMore } from '@/lib/queue';
import { Heading } from '../../../components/ui/heading';
import { LoadState } from '../../../components/ui/query-state';
import Link from 'next/link';
import { dateTime } from '../../../lib/date';
import type { ReportMeta } from '../../corrections/shared';

export function ReportsQueue() {
  const result = useQueue<ReportMeta>(['admin', 'reports'], '/admin/reports');
  return <><Heading eyebrow="ADMIN / LAPORAN" title="Laporan pengguna">Ambil penugasan dan catat alasan akses sebelum membaca isi laporan.</Heading><LoadState query={result} />{result.data?.length ? <div className="operations-list">{result.data.map((r) => <Link className="app-panel" href={`/app/admin/laporan/${r.id}`} key={r.id}><span className="eyebrow">{r.targetType} · {r.reasonCode}</span><h2>Laporan {r.id.slice(0, 8)}</h2><p>{r.status} · {dateTime(r.createdAt)}</p><span className="link-button">Tinjau laporan →</span></Link>)}</div> : result.data && <div className="empty-state"><h2>Tidak ada laporan terbuka.</h2></div>}<QueueMore query={result} /></>;
}
