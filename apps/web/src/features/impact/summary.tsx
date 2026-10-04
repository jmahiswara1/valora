'use client';

import type { ImpactDto } from '@valora/contracts';
import { dateTime } from '../../lib/date';

const metricNames: Record<string, string> = { ITEMS_REVALUED: 'Barang dinilai ulang', REPAIRS_RECORDED: 'Perbaikan dicatat', COMPLETED_TRANSFERS: 'Transfer selesai', ESTIMATED_TRANSFER_WEIGHT: 'Estimasi berat transfer', CONFIRMED_SALE_VALUE: 'Nilai Resell disepakati' };

function metricValue(metric: ImpactDto['metrics'][number]) {
  if (metric.value === null) return 'Belum tersedia';
  const value = BigInt(metric.value); const format = new Intl.NumberFormat('id-ID');
  if (metric.unit === 'GRAM') return format.format(value / BigInt(1000)) + ',' + (value % BigInt(1000)).toString().padStart(3, '0') + ' kg';
  return (metric.unit === 'IDR' ? 'Rp ' : '') + format.format(value);
}

export function ImpactSummary({ data }: { data: ImpactDto }) { return <><div className="impact-grid">{data.metrics.map((metric) => <section className="impact-metric" key={metric.metric}><span>{metricNames[metric.metric]}</span><strong>{metricValue(metric)}</strong>{metric.unit === 'GRAM' && <small>Berat diketahui untuk {data.weightCoverage.known}/{data.weightCoverage.total} barang yang ditransfer</small>}</section>)}</div><section className="app-panel"><h2>Cara membaca catatan ini</h2><ul>{data.notes.map((note) => <li key={note}>{note}</li>)}</ul><p className="muted">{data.from ? `Mulai ${dateTime(data.from)}` : 'Seluruh riwayat'}{data.to ? ` sampai sebelum ${dateTime(data.to)}` : ''}.</p></section></>; }
