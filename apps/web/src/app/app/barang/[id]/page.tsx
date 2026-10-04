'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { AssessmentDto, ItemDto } from '@valora/contracts';
import { api, ApiClientError } from '@/lib/api';
import { PrivateItemGallery } from '@/features/items/gallery';
import { Notice } from "@/components/ui/primitives";
import { AccountError } from '@/features/account/error';
import { AccountSkeleton } from '@/features/account/skeleton';
import { ConfirmAction } from '@/components/ui/confirm-dialog';

const labels: Record<string, string> = { functionSummary: 'Fungsi', conditionSummary: 'Kondisi', completenessSummary: 'Kelengkapan', issueSummary: 'Kendala', purchaseYear: 'Tahun pembelian', originalPriceIdr: 'Harga awal', estimatedWeightGrams: 'Perkiraan berat' };
const categoryNames: Record<string, string> = { electronics: 'Elektronik', furniture: 'Furnitur', fashion: 'Pakaian', books: 'Buku', household: 'Peralatan rumah tangga', sports: 'Peralatan olahraga', hobby: 'Barang hobi' };
export default function ItemDetail() {
  const { id } = useParams<{ id: string }>(); const cache = useQueryClient();
  const [removeId, setRemoveId] = useState<string | null>(null); const [removing, setRemoving] = useState(false); const [removeError, setRemoveError] = useState(''); const removePending = useRef(false);
  const query = useQuery({ queryKey: ['item', id], queryFn: () => api<ItemDto>(`/items/${id}`) });
  const assessments = useQuery({ queryKey: ['assessments', id], queryFn: () => api<AssessmentDto[]>(`/items/${id}/assessments`) });
  async function remove() { if (!removeId || removePending.current) return; removePending.current = true; setRemoving(true); setRemoveError(''); try { const item = await api<ItemDto>(`/items/${id}/media/${removeId}`, { method: 'DELETE' }); cache.setQueryData(['item', id], item); await cache.invalidateQueries({ queryKey: ['items'] }); setRemoveId(null); } catch (e) { setRemoveError(e instanceof ApiClientError ? e.message : 'Foto belum dihapus. Coba lagi.'); } finally { removePending.current = false; setRemoving(false); } }
  if (query.isPending) return <AccountSkeleton />;
  if (query.isError) return <AccountError retry={() => query.refetch()}>Barang tidak ditemukan atau gagal dimuat. <Link href="/app/barang">Kembali ke daftar</Link></AccountError>;
  const item = query.data;
  return <>
    <div className="app-heading"><div><Link className="eyebrow" href="/app/barang">← KEMBALI KE BARANG SAYA</Link><h1>{item.title}</h1><p>Catatan ini privat dan hanya dapat dilihat olehmu.</p></div>{!item.reservedByTransactionId && <Link className="button button-secondary" href={`/app/barang/${id}/edit`}>Edit barang</Link>}</div>
    {item.reservedByTransactionId && <Notice>Barang sedang direservasi. Perubahan barang, foto, penilaian, dan Repair tersedia setelah transaksi berakhir. <Link href={`/app/transaksi/${item.reservedByTransactionId}`}>Buka transaksi →</Link></Notice>}
    <div className="item-detail-grid">
      <PrivateItemGallery item={item} removing={removing} onRemove={(photoId) => { setRemoveError(''); setRemoveId(photoId); }} />
      <div className="detail-info"><h2>Tentang barang</h2><p className="meta">{categoryNames[item.categoryCode] ?? item.categoryCode}</p><p className="preserve-lines">{item.description}</p>
        <dl className="detail-list">{(Object.keys(labels) as (keyof ItemDto)[]).filter((key) => item[key] !== null && item[key] !== '').map((key) => <div key={key}><dt>{labels[key]}</dt><dd>{key === 'originalPriceIdr' ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(item[key])) : key === 'estimatedWeightGrams' ? `${item[key]} gram` : String(item[key])}</dd></div>)}</dl>
        <div className="form-actions"><Link className="button button-secondary" href={`/app/barang/${id}/passport`}>Passport barang</Link><Link className="button button-primary" href={`/app/barang/${id}/penilaian`}>Lihat penilaian</Link><Link className="button button-secondary" href={`/app/barang/${id}/perbaikan`}>Riwayat Repair</Link>{!item.reservedByTransactionId && <Link className="button button-quiet" href={`/app/barang/${id}/edit`}>Tambah foto atau edit detail</Link>}</div>
        {assessments.isError ? <Notice kind="error">Status penilaian gagal dimuat.</Notice> : assessments.isPending ? <div className="loading-line" /> : (() => { const current = assessments.data.find((entry) => entry.isCurrent); return current ? <Notice kind="success">{current.score === null ? current.status === 'PARTIAL_ECONOMIC' ? 'Nilai ekonomi belum lengkap; Score total belum tersedia.' : 'Penilaian belum lengkap.' : `Valora Score ${current.score} · ${current.label}.`} <Link href={`/app/barang/${id}/penilaian/${current.id}`}>Lihat hasil</Link></Notice> : <Notice>{assessments.data.length ? 'Penilaian lama sudah historis. Buat penilaian baru.' : 'Barang ini belum dinilai.'} {!item.reservedByTransactionId && <Link href={`/app/barang/${id}/penilaian/baru`}>Mulai penilaian</Link>}</Notice>; })()}
      </div>
    </div>
    {removeId && <ConfirmAction title="Hapus foto barang" buttonLabel="Hapus foto" pending={removing} onClose={() => setRemoveId(null)} onConfirm={remove}><p>Foto ini akan dihapus dari catatan barangmu.</p>{removeError && <Notice kind="error">{removeError}</Notice>}</ConfirmAction>}
  </>;
}
