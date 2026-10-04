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
import { listingTypeLabel as typeLabel } from '../market/labels';
import { ArrowUpRight } from 'lucide-react';
import { listingStatus } from './shared';

export function MyListingsPage() {
  const rows = useQuery({ queryKey: ['listings', 'mine'], queryFn: () => api<ListingDto[]>('/listings/mine') }); const [status, setStatus] = useState('');
  const filtered = rows.data?.filter((row) => !status || row.status === status) ?? [];
  return <><AccountHeading title="Listing saya" description="Kelola barang yang kamu tawarkan dan pantau proses review." actions={<Link className="button button-primary" href="/app/listings/new">Buat Listing</Link>} />
    <div className="account-list-toolbar"><Field label="Status Listing" htmlFor="listing-status"><Select id="listing-status" className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Semua status</option>{Object.entries(listingStatus).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</Select></Field></div>
    {rows.isPending ? <AccountSkeleton /> : rows.isError ? <AccountError retry={() => rows.refetch()}>Listing gagal dimuat.</AccountError> : filtered.length ? <div className="my-listings-list">{filtered.map((row) => <Link key={row.id} href={`/app/listings/${row.id}`} className="my-listing-row"><div><div className="account-row-status"><span className="badge">{listingStatus[row.status]}</span><span className="meta">{typeLabel[row.type]}</span></div><h2>{row.currentRevision?.title ?? 'Draft tanpa revisi'}</h2><p>{row.currentRevision?.city.name ?? 'Lokasi belum ditentukan'} · diperbarui {new Date(row.updatedAt).toLocaleDateString('id-ID')}</p></div><ArrowUpRight size={20} aria-hidden="true" /></Link>)}</div> : <div className="empty-state"><h3>{status ? 'Tidak ada Listing dengan status ini.' : 'Belum ada Listing.'}</h3><p>{status ? 'Pilih status lain untuk melihat Listingmu.' : 'Pilih barang yang sudah dinilai dan ajukan untuk review.'}</p>{status ? <Button variant="secondary" onClick={() => setStatus('')}>Tampilkan semua</Button> : <Link className="button button-primary" href="/app/listings/new">Mulai buat Listing</Link>}</div>}</>;
}
