'use client';

import { Select } from '@/components/ui/select';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ListingDto } from '@valora/contracts';
import { useState } from 'react';
import { AccountHeading } from '../account/heading';
import Link from 'next/link';
import { Field, Button } from "../../components/ui/primitives";
import { AccountSkeleton } from '../account/skeleton';
import { AccountError } from '../account/error';
import { listingTypeLabel as typeLabel, listingMoney } from '../market/labels';
import { ArrowUpRight, MapPin, Plus } from 'lucide-react';
import { listingStatus } from './shared';
import { PrivatePhoto } from '../items/photo';
import { CollectionSearch, CollectionTypes } from '../account/collection-controls';
import '@/styles/account-collections.css';

function ListingCard({ row }: { row: ListingDto }) {
  const revision = row.currentRevision;
  return <Link href={`/app/listings/${row.id}`} className="owner-listing-card">
    <div className="owner-listing-photo"><PrivatePhoto mediaId={revision?.media[0]?.id} alt={`Foto ${revision?.title ?? 'Draft Listing'}`} /></div>
    <div className="owner-listing-copy"><div className="collection-entry-meta"><span className="collection-status" data-status={row.status}>{listingStatus[row.status]}</span><span>{typeLabel[row.type]}</span></div>
      <h2>{revision?.title ?? 'Draft tanpa revisi'}</h2><p className="owner-listing-price">{row.type === 'RESELL' ? revision?.askingPriceIdr == null ? 'Harga belum diisi' : listingMoney(revision.askingPriceIdr) : row.type === 'EXCHANGE' ? 'Tukar barang' : 'Donasi'}</p>
      <p className="owner-listing-city"><MapPin size={14} aria-hidden="true" />{revision?.city.name ?? 'Lokasi belum ditentukan'}</p>
      <div className="owner-listing-footer"><time dateTime={row.updatedAt}>Diperbarui {new Date(row.updatedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</time><span>Kelola Listing <ArrowUpRight size={15} aria-hidden="true" /></span></div>
    </div>
  </Link>;
}

export function MyListingsPage() {
  const rows = useQuery({ queryKey: ['listings', 'mine'], queryFn: () => api<ListingDto[]>('/listings/mine'), refetchOnWindowFocus: true });
  const [filters, setFilters] = useState({ status: '', type: '', search: '' }), [visible, setVisible] = useState(12);
  function change(next: Partial<typeof filters>) { setFilters(current => ({ ...current, ...next })); setVisible(12); }
  const hasFilters = Boolean(filters.status || filters.type || filters.search);
  const filtered = rows.data?.filter(row => (!filters.status || row.status === filters.status) && (!filters.type || row.type === filters.type) && (row.currentRevision?.title ?? 'Draft tanpa revisi').toLocaleLowerCase('id-ID').includes(filters.search.trim().toLocaleLowerCase('id-ID'))) ?? [];
  return <div className="account-collection-page owner-listings-page"><AccountHeading title="Listing saya" description="Kelola barang yang kamu tawarkan dan pantau proses review." actions={<Link className="button button-primary" href="/app/listings/new"><Plus size={17} aria-hidden="true" />Buat Listing</Link>} />
    <div className="collection-toolbar"><div className="collection-search-row"><CollectionSearch id="listing-search" label="Cari Listing" value={filters.search} onChange={search => change({ search })} /><Field label="Status Listing" htmlFor="listing-status"><Select id="listing-status" className="select" value={filters.status} onChange={event => change({ status: event.target.value })}><option value="">Semua status</option>{Object.entries(listingStatus).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field></div>
      <div className="collection-filter-footer"><CollectionTypes label="Jenis Listing" value={filters.type} onChange={type => change({ type })} /></div>
    </div>
    {rows.isPending ? <AccountSkeleton cards /> : rows.isError ? <AccountError retry={() => rows.refetch()}>Listing gagal dimuat.</AccountError> : <>
      <div className="collection-result-header"><p className="collection-result-count" role="status">Menampilkan {Math.min(visible, filtered.length)} dari {filtered.length} Listing{rows.data.length === 100 ? ' · 100 Listing terbaru' : ''}</p><Button variant="quiet" disabled={!hasFilters} onClick={() => change({ status: '', type: '', search: '' })}>Reset filter</Button></div>
      {filtered.length ? <><div className="owner-listings-grid">{filtered.slice(0, visible).map(row => <ListingCard key={row.id} row={row} />)}</div>{visible < filtered.length && <div className="collection-pagination"><Button variant="secondary" onClick={() => setVisible(count => count + 12)}>Muat lebih banyak</Button></div>}</>
        : <div className="empty-state"><h3>{hasFilters ? 'Tidak ada Listing yang cocok.' : 'Belum ada Listing.'}</h3><p>{hasFilters ? 'Coba nama, jenis, atau status lain untuk melihat Listingmu.' : 'Pilih barang yang sudah dinilai dan ajukan untuk review.'}</p>{hasFilters ? <Button variant="secondary" onClick={() => change({ status: '', type: '', search: '' })}>Tampilkan semua</Button> : <Link className="button button-primary" href="/app/listings/new">Mulai buat Listing</Link>}</div>}
    </>}
  </div>;
}
