'use client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ListingDto, ItemDto } from '@valora/contracts';
import { useState, useRef } from 'react';
import { Pencil } from 'lucide-react';
import { AccountSkeleton } from '../account/skeleton';
import { Notice, Button } from '@/components/ui/primitives';
import Link from 'next/link';
import { listingTypeLabel, listingConditionLabel, listingMoney, listingHandoverLabel } from '../market/labels';
import { ConfirmAction } from '@/components/ui/confirm-dialog';
import { DeleteOwnedButton } from '../account/delete-owned';
import { listingStatus } from './shared';

export function ListingOwnerDetail({ id }: { id: string }) {
  const cache = useQueryClient();
  const listing = useQuery({ queryKey: ['listings', id], queryFn: () => api<ListingDto>(`/listings/${id}`) });
  const item = useQuery({ queryKey: ['item', listing.data?.itemId], queryFn: () => api<ItemDto>(`/items/${listing.data!.itemId}`), enabled: Boolean(listing.data) });
  const [notice, setNotice] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [withdrawOpen, setWithdrawOpen] = useState(false); const running = useRef(false);
  async function act(operation: 'submit' | 'withdraw') {
    if (!listing.data || running.current) return; running.current = true; setBusy(true); setError('');
    try {
      await api(`/listings/${id}/${operation}`, { method: 'POST', body: { expectedVersion: listing.data.version } });
      setWithdrawOpen(false); await cache.invalidateQueries({ queryKey: ['listings'] });
      setNotice(operation === 'submit' ? 'Listing dikirim untuk review.' : 'Listing ditarik. Kamu dapat mengeditnya dan mengajukan kembali.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Tindakan belum berhasil. Coba lagi.'); }
    finally { running.current = false; setBusy(false); }
  }
  if (listing.isPending) return <AccountSkeleton />;
  if (listing.isError || !listing.data) return <Notice kind="error">Listing tidak ditemukan. <Link href="/app/listings">Kembali ke Listing saya</Link></Notice>;
  const row = listing.data, rev = row.currentRevision;
  const reserved = row.status === 'RESERVED' || (row.status !== 'CLOSED' && Boolean(item.data?.reservedByTransactionId));
  const ready = Boolean(item.data) && !item.isError && !busy;
  const editable = !['RESERVED', 'CLOSED', 'SUSPENDED'].includes(row.status) && !reserved;
  return <><Link className="back-link" href="/app/listings">← Semua Listing</Link><div className="app-heading"><div><span className="badge">{listingStatus[row.status]}</span><h1>{rev?.title ?? 'Draf Listing'}</h1><p>{rev?.city.name ?? 'Lokasi belum diatur'} · revisi {rev?.revisionNo ?? 0}</p></div><div className="form-actions">{editable && <Link className="button button-secondary" href={`/app/listings/${id}/edit`}><Pencil size={16} aria-hidden="true" />Edit Listing</Link>}<DeleteOwnedButton kind="listing" id={id} version={row.version} disabled={busy || reserved || (!ready && row.status !== 'CLOSED')} /></div></div>
    {reserved && <Notice>Listing sedang dalam transaksi. Edit dan hapus tersedia setelah transaksi selesai atau dibatalkan.</Notice>}
    {row.status === 'PENDING_REVIEW' && <Notice>Listing sedang ditinjau. Kamu bisa mengeditnya; perubahan disimpan sebagai draf untuk diajukan ulang.</Notice>}
    {row.status === 'ACTIVE' && <Notice kind="success">Listing tampil di Market. Menyimpan perubahan akan menjeda Listing dan mengakhiri penawaran terbuka sampai review berikutnya.</Notice>}
    {row.status === 'SUSPENDED' && <Notice>Listing ditangguhkan. Hubungi admin untuk menindaklanjuti statusnya.</Notice>}
    {error && !withdrawOpen && <Notice kind="error">{error} <Button variant="quiet" onClick={() => void listing.refetch()}>Muat ulang detail</Button></Notice>}{notice && <Notice kind="success">{notice}</Notice>}
    {rev && <section className="app-panel form-stack"><h2>Ringkasan Listing</h2><p className="preserve-lines">{rev.description}</p><dl className="detail-list"><div><dt>Jenis</dt><dd>{listingTypeLabel[row.type]}</dd></div><div><dt>Kondisi</dt><dd>{listingConditionLabel(rev.condition)}</dd></div><div><dt>Keterangan kondisi</dt><dd>{rev.conditionDisclosure}</dd></div><div><dt>Harga</dt><dd>{rev.askingPriceIdr === null ? '—' : listingMoney(rev.askingPriceIdr)}</dd></div><div><dt>Serah terima</dt><dd>{listingHandoverLabel(rev.handoverMethods)}</dd></div>{rev.exchangePreference && <div><dt>Barang yang dicari</dt><dd>{rev.exchangePreference}</dd></div>}{rev.recipientNote && <div><dt>Pesan penerima</dt><dd>{rev.recipientNote}</dd></div>}</dl><Link href={`/app/barang/${row.itemId}`}>Buka barang</Link>
      <div className="form-actions">{['DRAFT', 'PAUSED', 'REJECTED'].includes(row.status) && <Button disabled={!ready} onClick={() => void act('submit')}>{busy ? 'Mengirim…' : 'Kirim untuk review'}</Button>}{['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'REJECTED'].includes(row.status) && <Button variant="quiet" disabled={!ready || reserved} onClick={() => { setError(''); setWithdrawOpen(true); }}>Tarik Listing</Button>}</div>
    </section>}
    {withdrawOpen && <ConfirmAction title="Tarik Listing" buttonLabel="Tarik Listing" pending={busy} onClose={() => setWithdrawOpen(false)} onConfirm={() => act('withdraw')}><p>Listing berhenti tampil di Market dan penawaran terbuka berakhir. Listing tetap tersedia di daftar milikmu untuk diedit.</p>{error && <Notice kind="error">{error}</Notice>}</ConfirmAction>}
  </>;
}
