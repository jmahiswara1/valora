'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { AssessmentDto } from '@valora/contracts';
import { AssessmentResult } from '@/features/assessments/result';
import { Notice } from "@/components/ui/primitives";
import { AccountSkeleton } from '@/features/account/skeleton';
import { api } from '@/lib/api';

export default function AssessmentDetailPage() {
  const { id, assessmentId } = useParams<{ id: string; assessmentId: string }>();
  const query = useQuery({ queryKey: ['assessment', assessmentId], queryFn: () => api<AssessmentDto>(`/assessments/${assessmentId}`) });
  if (query.isPending) return <AccountSkeleton />;
  if (query.isError || query.data.itemId !== id) return <Notice kind="error">Penilaian tidak ditemukan. <Link href={`/app/barang/${id}/penilaian`}>Kembali ke riwayat</Link></Notice>;
  return <><div className="app-heading"><div><Link className="eyebrow" href={`/app/barang/${id}/penilaian`}>← RIWAYAT PENILAIAN</Link><h1>Hasil penilaian</h1><p>{new Date(query.data.createdAt).toLocaleDateString('id-ID')} · laporan pemilik</p></div></div><AssessmentResult assessment={query.data} itemId={id} /></>;
}
