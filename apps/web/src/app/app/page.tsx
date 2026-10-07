'use client';

import Link from 'next/link';
import { ChevronRight, Handshake, MessageCircle, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { ConversationDto, ItemDto, OfferDto } from '@valora/contracts';
import { api, apiEnvelope } from '@/lib/api';
import { useMe } from '@/lib/session';
import { ItemCard } from '@/features/items/card';
import { AccountError } from '@/features/account/error';
import { AccountHeading } from '@/features/account/heading';
import { AccountSkeleton } from '@/features/account/skeleton';
import { DashboardNotifications } from '@/features/notifications/dashboard';

export default function Dashboard() {
  const me = useMe();
  const items = useQuery({ queryKey: ['items', 'recent'], queryFn: () => apiEnvelope<ItemDto[]>('/items?limit=4') });
  const offers = useQuery({ queryKey: ['offers', 'mine'], queryFn: () => api<OfferDto[]>('/offers/mine'), refetchInterval: 30000 });
  const messages = useQuery({ queryKey: ['conversations'], queryFn: () => api<ConversationDto[]>('/conversations'), refetchInterval: 10000 });
  const responses = offers.data?.filter((row) => ['PENDING', 'COUNTERED'].includes(row.status) && row.currentRevision?.respondsById === me.data?.id && new Date(row.expiresAt).getTime() > offers.dataUpdatedAt) ?? [];
  const unreadMessages = messages.data?.filter((row) => row.unreadCount > 0) ?? [];
  return <>
    <AccountHeading title={`Halo, ${me.data?.displayName ?? 'kamu'}.`} description="Lihat yang perlu ditindaklanjuti, lalu lanjutkan cerita barangmu." actions={<Link className="button button-primary" href="/app/barang/baru"><Plus size={17} aria-hidden="true" />Tambah barang</Link>} />
    <div className="account-activity-grid">
      <DashboardNotifications />
      <section className="account-activity" aria-labelledby="dashboard-offers"><div className="account-activity-heading"><h2 id="dashboard-offers">Perlu tanggapan</h2><Handshake size={19} aria-hidden="true" /></div>
        {offers.isPending ? <AccountSkeleton /> : offers.isError ? <AccountError retry={() => offers.refetch()}>Penawaran gagal dimuat.</AccountError> : responses.length ? <ul>{responses.slice(0, 3).map((row) => <li key={row.id}><Link href="/app/penawaran"><strong>{row.listing.title}</strong><small>{row.status === 'COUNTERED' ? 'Ada penawaran balik' : 'Menunggu responsmu'} · sampai {new Date(row.expiresAt).toLocaleDateString('id-ID')}</small></Link></li>)}</ul> : <p>Semua tanggapan sudah beres. Penawaran yang menunggu responsmu akan tampil di sini.</p>}
        <Link className="account-activity-footer" href="/app/penawaran">Lihat penawaran <ChevronRight size={15} aria-hidden="true" /></Link>
      </section>
      <section className="account-activity" aria-labelledby="dashboard-messages"><div className="account-activity-heading"><h2 id="dashboard-messages">Pesan baru</h2><MessageCircle size={19} aria-hidden="true" /></div>
        {messages.isPending ? <AccountSkeleton /> : messages.isError ? <AccountError retry={() => messages.refetch()}>Pesan gagal dimuat.</AccountError> : unreadMessages.length ? <ul>{unreadMessages.slice(0, 3).map((row) => <li key={row.id}><Link href={`/app/pesan/${row.id}`}><strong>{row.participant.displayName}</strong><small>{row.listingTitle} · {row.unreadCount} belum dibaca</small></Link></li>)}</ul> : <p>Tidak ada pesan belum dibaca. Percakapan tentang barang tersimpan di halaman Pesan.</p>}
        <Link className="account-activity-footer" href="/app/pesan">Buka pesan <ChevronRight size={15} aria-hidden="true" /></Link>
      </section>
    </div>
    <section aria-labelledby="dashboard-items"><div className="account-recent-header"><div><h2 id="dashboard-items">Barang terbaru</h2><p>Catatan privat dari barang yang kamu miliki.</p></div><Link href="/app/barang">Lihat semua <ChevronRight size={16} aria-hidden="true" /></Link></div>
      {items.isPending ? <AccountSkeleton cards /> : items.isError ? <AccountError retry={() => items.refetch()}>Barang gagal dimuat.</AccountError> : items.data.data.length ? <div className="item-grid">{items.data.data.map((item) => <ItemCard item={item} key={item.id} />)}</div> : <div className="empty-state"><h3>Mulai dari satu barang.</h3><p>Tambahkan foto, nama, dan cerita singkat. Kamu bisa melengkapi catatannya kapan saja.</p><Link className="button button-primary" href="/app/barang/baru">Tambah barang pertama</Link></div>}
    </section>
  </>;
}
