'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, Fingerprint, LockKeyhole, Pencil, Wrench } from 'lucide-react';
import type { AssessmentDto, ItemDto } from '@valora/contracts';
import { api, ApiClientError } from '@/lib/api';
import { PrivateItemGallery } from '@/features/items/gallery';
import { Notice } from "@/components/ui/primitives";
import { AccountError } from '@/features/account/error';
import { AccountSkeleton } from '@/features/account/skeleton';
import { ConfirmAction } from '@/components/ui/confirm-dialog';
import { PassportQrButton } from '@/features/passport/qr';
import { ItemAssessmentSummary } from '@/features/items/assessment-summary';
import '@/styles/item-detail.css';

const conditionFields = [['functionSummary', 'Fungsi'], ['conditionSummary', 'Kondisi'], ['completenessSummary', 'Kelengkapan'], ['issueSummary', 'Kendala']] as const;
const categoryNames: Record<string, string> = { electronics: 'Elektronik', furniture: 'Furnitur', fashion: 'Pakaian', books: 'Buku', household: 'Peralatan rumah tangga', sports: 'Peralatan olahraga', hobby: 'Barang hobi' };
const emptyValue = <span className="item-detail-missing">Belum diisi</span>;
export default function ItemDetail() {
  const { id } = useParams<{ id: string }>(); const cache = useQueryClient();
  const [removeId, setRemoveId] = useState<string | null>(null); const [removing, setRemoving] = useState(false); const [removeError, setRemoveError] = useState(''); const removePending = useRef(false);
  const gallery = useRef<HTMLDivElement>(null), focusAfterRemoval = useRef(false);
  const query = useQuery({ queryKey: ['item', id], queryFn: () => api<ItemDto>(`/items/${id}`) });
  const assessments = useQuery({ queryKey: ['assessments', id], queryFn: () => api<AssessmentDto[]>(`/items/${id}/assessments`) });
  useEffect(() => {
    if (removeId || !focusAfterRemoval.current) return;
    focusAfterRemoval.current = false;
    const target = gallery.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ?? gallery.current;
    target?.focus({ preventScroll: true });
  }, [removeId]);
  async function remove() { if (!removeId || removePending.current) return; removePending.current = true; setRemoving(true); setRemoveError(''); try { const item = await api<ItemDto>(`/items/${id}/media/${removeId}`, { method: 'DELETE' }); cache.setQueryData(['item', id], item); await Promise.all([cache.invalidateQueries({ queryKey: ['items'] }), cache.invalidateQueries({ queryKey: ['assessments', id] })]); focusAfterRemoval.current = true; setRemoveId(null); } catch (e) { setRemoveError(e instanceof ApiClientError ? e.message : 'Foto belum dihapus. Coba lagi.'); } finally { removePending.current = false; setRemoving(false); } }
  if (query.isPending) return <AccountSkeleton />;
  if (query.isError) return <AccountError retry={() => query.refetch()}>Barang tidak ditemukan atau gagal dimuat. <Link href="/app/barang">Kembali ke daftar</Link></AccountError>;
  const item = query.data;
  return <div className="item-detail-page">
    <header className="item-detail-heading">
      <Link className="item-detail-back" href="/app/barang"><ArrowLeft size={17} aria-hidden="true" />Barang saya</Link>
      <div className="item-detail-title-row"><h1>{item.title}</h1>{!item.reservedByTransactionId && <Link className="button button-secondary" href={`/app/barang/${id}/edit`}><Pencil size={16} aria-hidden="true" />Edit barang</Link>}</div>
      <div className="item-detail-metadata"><span className="item-detail-category">{categoryNames[item.categoryCode] ?? item.categoryCode}</span><span><LockKeyhole size={14} aria-hidden="true" />Catatan privat</span><span>Diperbarui <time dateTime={item.updatedAt}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(item.updatedAt))}</time></span></div>
    </header>
    {item.reservedByTransactionId && <Notice>Barang sedang direservasi. Perubahan barang, foto, penilaian, dan Repair tersedia setelah transaksi berakhir. <Link href={`/app/transaksi/${item.reservedByTransactionId}`}>Buka transaksi →</Link></Notice>}
    <div className="item-detail-overview">
      <div ref={gallery} className="item-detail-gallery" tabIndex={-1}><PrivateItemGallery key={id} item={item} removing={removing} onRemove={(photoId) => { setRemoveError(''); setRemoveId(photoId); }} /></div>
      <div className="item-detail-summary">
        <ItemAssessmentSummary itemId={id} assessments={assessments.data} loading={assessments.isPending} error={assessments.isError} reserved={Boolean(item.reservedByTransactionId)} retry={() => void assessments.refetch()} />
        <section className="item-detail-shortcuts" aria-labelledby="item-detail-shortcuts-title"><h2 id="item-detail-shortcuts-title">Lanjutkan dengan barang ini</h2>
          <div className="item-detail-shortcut-group"><h3>Identitas barang</h3><div className="item-detail-passport-actions"><Link className="item-detail-shortcut" href={`/app/barang/${id}/passport`}><Fingerprint size={19} aria-hidden="true" /><span>Passport barang</span><ArrowUpRight size={16} aria-hidden="true" /></Link><PassportQrButton itemId={id} owner /></div></div>
          <div className="item-detail-shortcut-group"><h3>Perawatan dan panduan</h3><Link className="item-detail-shortcut" href={`/app/barang/${id}/perbaikan`}><Wrench size={19} aria-hidden="true" /><span>Perawatan & perbaikan</span><ArrowUpRight size={16} aria-hidden="true" /></Link><Link className="item-detail-shortcut" href={`/app/barang/${id}/panduan`}><BookOpen size={19} aria-hidden="true" /><span>Lihat panduan</span><ArrowUpRight size={16} aria-hidden="true" /></Link></div>
        </section>
      </div>
    </div>
    <section className="item-detail-description" aria-labelledby="item-detail-about-title"><h2 id="item-detail-about-title">Tentang barang</h2><p className="preserve-lines">{item.description}</p></section>
    <div className="item-detail-facts-grid">
      <section aria-labelledby="item-detail-condition-title"><h2 id="item-detail-condition-title">Kondisi dan kelengkapan</h2><dl className="item-detail-facts">{conditionFields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{item[key] || emptyValue}</dd></div>)}</dl></section>
      <section aria-labelledby="item-detail-extra-title"><h2 id="item-detail-extra-title">Informasi tambahan</h2><dl className="item-detail-facts"><div><dt>Tahun pembelian</dt><dd>{item.purchaseYear ?? emptyValue}</dd></div><div><dt>Harga awal</dt><dd>{item.originalPriceIdr === null ? emptyValue : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.originalPriceIdr)}</dd></div><div><dt>Perkiraan berat</dt><dd>{item.estimatedWeightGrams === null ? emptyValue : `${new Intl.NumberFormat('id-ID').format(item.estimatedWeightGrams)} gram`}</dd></div></dl></section>
    </div>
    {removeId && <ConfirmAction title="Hapus foto barang" buttonLabel="Hapus foto" pending={removing} onClose={() => setRemoveId(null)} onConfirm={remove}><p>Foto ini akan dihapus dari catatan barangmu.</p>{removeError && <Notice kind="error">{removeError}</Notice>}</ConfirmAction>}
  </div>;
}
