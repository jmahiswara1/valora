'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { AssessmentDto, ItemDto } from '@valora/contracts';
import { AssessmentResult } from '@/features/assessments/result';
import { AccountError } from '@/features/account/error';
import { AccountSkeleton } from '@/features/account/skeleton';
import { api } from '@/lib/api';

export default function AssessmentsPage() {
  const { id } = useParams<{ id: string }>();
  const item = useQuery({ queryKey: ['item', id], queryFn: () => api<ItemDto>(`/items/${id}`) });
  const history = useQuery({ queryKey: ['assessments', id], queryFn: () => api<AssessmentDto[]>(`/items/${id}/assessments`) });
  if (item.isPending || history.isPending) return <AccountSkeleton />;
  if (item.isError || history.isError) return <AccountError retry={() => { void item.refetch(); void history.refetch(); }}>Riwayat penilaian gagal dimuat. <Link href={`/app/barang/${id}`}>Kembali ke barang</Link></AccountError>;
  const current = history.data.find((entry) => entry.isCurrent);
  return <><div className="app-heading"><div><Link className="eyebrow" href={`/app/barang/${id}`}>← {item.data.title}</Link><h1>Valora Score</h1><p>Nilai menurut jawaban pemilik dan rubrik yang tercatat.</p></div><Link className="button button-primary" href={`/app/barang/${id}/penilaian/baru`}>Buat penilaian baru</Link></div>
    {current ? <AssessmentResult assessment={current} itemId={id} /> : <div className="empty-state"><h3>{history.data.length ? 'Penilaian perlu diperbarui' : 'Belum ada penilaian'}</h3><p>{history.data.length ? 'Barang atau rubrik telah berubah. Hasil sebelumnya tetap tersedia di riwayat.' : 'Jawab pertanyaan tentang kondisi, keselamatan, dan nilai ekonomi untuk melihat hasilnya.'}</p><Link className="button button-primary" href={`/app/barang/${id}/penilaian/baru`}>Mulai penilaian</Link></div>}
    <section className="assessment-section"><h3>Riwayat penilaian</h3>{history.data.length ? <div className="history-list">{history.data.map((entry) => <Link key={entry.id} href={`/app/barang/${id}/penilaian/${entry.id}`}><div><strong>{entry.score === null ? entry.status === 'PARTIAL_ECONOMIC' ? 'Ekonomi belum lengkap' : 'Belum lengkap' : `${entry.score} · ${entry.label}`}</strong><small>{new Date(entry.createdAt).toLocaleDateString('id-ID')} · {entry.ruleVersion}</small></div><span className={`badge ${entry.isCurrent ? 'badge-green' : 'badge-warn'}`}>{entry.isCurrent ? 'TERKINI' : 'HISTORIS'}</span></Link>)}</div> : <p className="muted">Belum ada riwayat.</p>}</section>
  </>;
}
