'use client';

import { useQuery } from '@tanstack/react-query';
import { apiEnvelope } from '@/lib/api';
import type { ModerationQueueDto } from '@valora/contracts';
import { Notice } from "../../../components/ui/primitives";
import Link from 'next/link';

export function ModerationQueuePage() {
  const queue = useQuery({ queryKey: ['admin', 'listing-reviews'], queryFn: () => apiEnvelope<ModerationQueueDto[]>('/admin/listing-reviews') });
  return <><div className="app-heading"><div><span className="eyebrow">ADMIN / MARKET</span><h1>Review Listing</h1><p>Periksa laporan dan kondisi barang sebelum Listing diterbitkan.</p></div></div>{queue.isPending ? <div className="loading-line" /> : queue.isError ? <Notice kind="error">Antrean tidak tersedia untuk akun ini.</Notice> : queue.data.data.length ? <div className="review-queue">{queue.data.data.map((entry) => <Link href={`/app/admin/moderasi/${entry.revisionId}`} key={entry.revisionId} className="review-queue-row"><div><span className="eyebrow">{entry.listingType} · {entry.specialReview ? 'REVIEW KHUSUS' : 'REVIEW AWAL'}</span><h2>{entry.title}</h2><p>{entry.ownerName} · {entry.cityName} · revisi {entry.revisionNo}</p></div><span className="meta">{new Date(entry.submittedAt).toLocaleDateString('id-ID')}</span></Link>)}</div> : <div className="empty-state"><h3>Antrean kosong.</h3><p>Listing yang baru dikirim akan muncul di sini.</p></div>}</>;
}
