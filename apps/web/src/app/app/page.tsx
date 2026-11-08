'use client';

import Link from 'next/link';
import { ArrowUpRight, CheckCheck, ChevronRight, Handshake, MessageCircle, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ConversationDto, ItemDto, OfferDto } from '@valora/contracts';
import { api, apiEnvelope } from '@/lib/api';
import { useMe } from '@/lib/session';
import { ItemCard } from '@/features/items/card';
import { AccountError } from '@/features/account/error';
import { AccountHeading } from '@/features/account/heading';
import { AccountSkeleton } from '@/features/account/skeleton';
import { DashboardNotifications } from '@/features/notifications/dashboard';
import { listingMoney } from '@/features/market/labels';
import { offerPhase } from '@/features/offers/phase';
import { ProfileAvatar } from '@/features/profile/avatar';
import '@/styles/dashboard.css';

export default function Dashboard() {
  const me = useMe();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15000); return () => window.clearInterval(timer); }, []);
  const items = useQuery({ queryKey: ['items', 'recent'], queryFn: () => apiEnvelope<ItemDto[]>('/items?limit=4') });
  const offers = useQuery({ queryKey: ['offers', 'mine'], queryFn: () => api<OfferDto[]>('/offers/mine'), refetchInterval: 30000 });
  const messages = useQuery({ queryKey: ['conversations'], queryFn: () => api<ConversationDto[]>('/conversations'), refetchInterval: 10000 });
  const responses = offers.data?.filter(row => offerPhase(row, me.data?.id ?? '', now) === 'response') ?? [];
  const unreadMessages = messages.data?.filter((row) => row.unreadCount > 0) ?? [];
  const noItems = items.isSuccess && items.data.data.length === 0;
  const recentItems = <section className="dashboard-recent" aria-labelledby="dashboard-items"><div className="account-recent-header"><div><h2 id="dashboard-items">Barang terbaru</h2><p>Catatan privat dari barang yang kamu miliki.</p></div><Link href="/app/barang">Lihat semua <ChevronRight size={16} aria-hidden="true" /></Link></div>
    {items.isPending ? <AccountSkeleton cards /> : items.isError ? <AccountError retry={() => items.refetch()}>Barang gagal dimuat.</AccountError> : items.data.data.length ? <div className="item-grid">{items.data.data.map(item => <ItemCard item={item} key={item.id} />)}</div> : <div className="empty-state"><h3>Mulai dari satu barang.</h3><p>Tambahkan foto, nama, dan cerita singkat. Kamu bisa melengkapi catatannya kapan saja.</p><Link className="button button-primary" href="/app/barang/baru">Tambah barang pertama</Link></div>}
  </section>;
  return <div className="dashboard-page">
    <AccountHeading title={`Halo, ${me.data?.displayName ?? 'kamu'}.`} description="Lihat yang perlu ditindaklanjuti, lalu lanjutkan cerita barangmu." actions={<Link className="button button-primary" href="/app/barang/baru"><Plus size={17} aria-hidden="true" />Tambah barang</Link>} />
    {noItems && recentItems}
    <div className="dashboard-workspace">
    <div className="dashboard-activity-grid">
      <section className="account-activity dashboard-offers" aria-labelledby="dashboard-offers"><div className="account-activity-heading"><div className="dashboard-section-title"><Handshake size={20} aria-hidden="true" /><h2 id="dashboard-offers">Perlu tanggapan</h2></div></div>
        {offers.isPending ? <AccountSkeleton /> : offers.isError ? <AccountError retry={() => offers.refetch()}>Penawaran gagal dimuat.</AccountError> : responses.length ? <ul className="dashboard-task-list">{responses.slice(0, 3).map(row => <li key={row.id}><Link className="dashboard-offer-link" href={`/app/penawaran/${row.id}`}><span className="dashboard-offer-copy"><strong>{row.listing.title}</strong><span className="dashboard-offer-terms">{row.listing.type === 'DONATE' ? 'Permintaan donasi' : row.listing.type === 'EXCHANGE' ? 'Tukar barang' : row.currentRevision?.priceIdr == null ? 'Nominal belum tersedia' : listingMoney(row.currentRevision.priceIdr)}<span>{row.status === 'COUNTERED' ? 'Ada penawaran balik' : 'Menunggu responsmu'}</span></span><time dateTime={row.expiresAt}>Batas tanggapan {new Date(row.expiresAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</time></span><ArrowUpRight size={18} aria-hidden="true" /></Link></li>)}</ul> : <div className="dashboard-empty"><CheckCheck size={22} aria-hidden="true" /><div><strong>Belum ada yang perlu ditanggapi.</strong><p>Penawaran yang menunggu keputusanmu akan muncul di sini.</p></div></div>}
        <Link className="account-activity-footer" href="/app/penawaran">Lihat penawaran <ChevronRight size={15} aria-hidden="true" /></Link>
      </section>
      <section className="account-activity dashboard-messages" aria-labelledby="dashboard-messages"><div className="account-activity-heading"><div className="dashboard-section-title"><MessageCircle size={20} aria-hidden="true" /><h2 id="dashboard-messages">Pesan baru</h2></div></div>
        {messages.isPending ? <AccountSkeleton /> : messages.isError ? <AccountError retry={() => messages.refetch()}>Pesan gagal dimuat.</AccountError> : unreadMessages.length ? <ul className="dashboard-task-list">{unreadMessages.slice(0, 3).map(row => <li key={row.id}><Link className="dashboard-message-link" href={`/app/pesan/${row.id}`}><ProfileAvatar photoUrl={null} displayName={row.participant.displayName} className="dashboard-participant" /><span><strong>{row.participant.displayName}</strong><small>{row.listingTitle}</small><span className="dashboard-message-count">{row.unreadCount} belum dibaca</span></span><ChevronRight size={16} aria-hidden="true" /></Link></li>)}</ul> : <div className="dashboard-empty"><MessageCircle size={22} aria-hidden="true" /><div><strong>Belum ada pesan baru.</strong><p>Percakapanmu tetap tersimpan di halaman Pesan.</p></div></div>}
        <Link className="account-activity-footer" href="/app/pesan">Buka pesan <ChevronRight size={15} aria-hidden="true" /></Link>
      </section>
    </div>
    <DashboardNotifications />
    {!noItems && recentItems}
    </div>
  </div>;
}
