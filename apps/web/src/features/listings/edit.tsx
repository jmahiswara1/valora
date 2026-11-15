'use client';
import { useQuery } from '@tanstack/react-query';
import type { ItemDto, ListingDto } from '@valora/contracts';
import { api } from '@/lib/api';
import { AccountSkeleton } from '../account/skeleton';
import { Button, Notice } from '@/components/ui/primitives';
import { OfferForm } from './form';
import Link from 'next/link';

export function ListingEditForm({ id }: { id: string }) {
  const listing = useQuery({ queryKey: ['listings', id], queryFn: () => api<ListingDto>(`/listings/${id}`) });
  const item = useQuery({ queryKey: ['item', listing.data?.itemId], queryFn: () => api<ItemDto>(`/items/${listing.data!.itemId}`), enabled: Boolean(listing.data) });
  if (listing.isPending || (listing.data && item.isPending)) return <AccountSkeleton />;
  if (listing.isError || item.isError || !listing.data || !item.data) return <Notice kind="error">Listing atau barang tidak dapat dimuat. <Button variant="quiet" onClick={() => { void listing.refetch(); void item.refetch(); }}>Coba lagi</Button></Notice>;
  const row = listing.data;
  if (!row.currentRevision) return <Notice>Listing ini belum memiliki revisi. <Link href="/app/listings/new">Buat Listing</Link></Notice>;
  if (['RESERVED', 'CLOSED', 'SUSPENDED'].includes(row.status) || item.data.reservedByTransactionId) return <Notice>Listing ini belum dapat diedit pada statusnya saat ini. <Link href={`/app/listings/${id}`}>Kembali ke Listing</Link></Notice>;
  return <><Link className="back-link" href={`/app/listings/${id}`}>← Kembali ke Listing</Link><div className="app-heading"><div><h1>Edit Listing</h1><p>Simpan perubahan, lalu kirim ulang untuk review. Listing aktif dijeda dan penawaran terbuka berakhir saat perubahan disimpan.</p></div></div><OfferForm key={row.id} listing={row} item={item.data} type={row.type} setType={() => {}} initialCity={row.currentRevision.city} refreshItem={() => void item.refetch()} /></>;
}
