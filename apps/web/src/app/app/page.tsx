'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CheckCheck,
  ChevronRight,
  Handshake,
  MessageCircle,
  Plus,
} from 'lucide-react';

import type { ConversationDto, ItemDto, OfferDto } from '@valora/contracts';

import { api, apiEnvelope } from '@/lib/api';
import { useMe } from '@/lib/session';
import { AccountError } from '@/features/account/error';
import { AccountHeading } from '@/features/account/heading';
import { AccountSkeleton } from '@/features/account/skeleton';
import { ChatLink } from '@/features/conversations/link';
import { ItemCard } from '@/features/items/card';
import { listingMoney } from '@/features/market/labels';
import { DashboardNotifications } from '@/features/notifications/dashboard';
import { offerPhase } from '@/features/offers/phase';
import { ProfileAvatar } from '@/features/profile/avatar';

import '@/styles/dashboard.css';

export default function Dashboard() {
  const me = useMe();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const items = useQuery({
    queryKey: ['items', 'recent'],
    queryFn: () => apiEnvelope<ItemDto[]>('/items?limit=4'),
  });

  const offers = useQuery({
    queryKey: ['offers', 'mine'],
    queryFn: () => api<OfferDto[]>('/offers/mine'),
    refetchInterval: 30000,
  });

  const messages = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api<ConversationDto[]>('/conversations'),
    refetchInterval: 10000,
  });

  const responses =
    offers.data?.filter(
      offer => offerPhase(offer, me.data?.id ?? '', now) === 'response',
    ) ?? [];

  const unreadMessages =
    messages.data?.filter(conversation => conversation.unreadCount > 0) ?? [];

  const noItems = items.isSuccess && items.data.data.length === 0;

  const recentItems = (
    <section className="dashboard-recent" aria-labelledby="dashboard-items">
      <div className="account-recent-header">
        <div>
          <h2 id="dashboard-items">Barang terbaru</h2>
          <p>Catatan privat dari barang yang kamu miliki.</p>
        </div>

        <Link href="/app/barang">
          Lihat semua <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>

      {items.isPending ? (
        <AccountSkeleton cards />
      ) : items.isError ? (
        <AccountError retry={() => items.refetch()}>
          Barang gagal dimuat.
        </AccountError>
      ) : items.data.data.length > 0 ? (
        <div className="item-grid">
          {items.data.data.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>Mulai dari satu barang.</h3>
          <p>
            Tambahkan foto, nama, dan cerita singkat. Kamu bisa melengkapi
            catatannya kapan saja.
          </p>

          <Link className="button button-primary" href="/app/barang/baru">
            Tambah barang pertama
          </Link>
        </div>
      )}
    </section>
  );

  return (
    <div className="dashboard-page">
      <AccountHeading
        title={`Halo, ${me.data?.displayName ?? 'kamu'}.`}
        description="Lihat yang perlu ditindaklanjuti, lalu lanjutkan cerita barangmu."
        actions={
          <Link className="button button-primary" href="/app/barang/baru">
            <Plus size={17} aria-hidden="true" />
            Tambah barang
          </Link>
        }
      />

      {noItems && recentItems}

      <div className="dashboard-workspace">
        <div className="dashboard-activity-grid">
          <section
            className="account-activity dashboard-offers"
            aria-labelledby="dashboard-offers"
          >
            <div className="account-activity-heading">
              <div className="dashboard-section-title">
                <Handshake size={20} aria-hidden="true" />
                <h2 id="dashboard-offers">Perlu tanggapan</h2>
              </div>
            </div>

            {offers.isPending ? (
              <AccountSkeleton />
            ) : offers.isError ? (
              <AccountError retry={() => offers.refetch()}>
                Penawaran gagal dimuat.
              </AccountError>
            ) : responses.length > 0 ? (
              <ul className="dashboard-task-list">
                {responses.slice(0, 3).map(offer => {
                  const price = offer.currentRevision?.priceIdr;
                  let terms = 'Nominal belum tersedia';

                  if (offer.listing.type === 'DONATE') {
                    terms = 'Permintaan donasi';
                  } else if (offer.listing.type === 'EXCHANGE') {
                    terms = 'Tukar barang';
                  } else if (price != null) {
                    terms = listingMoney(price);
                  }

                  return (
                    <li key={offer.id}>
                      <Link
                        className="dashboard-offer-link"
                        href={`/app/penawaran/${offer.id}`}
                      >
                        <span className="dashboard-offer-copy">
                          <strong>{offer.listing.title}</strong>

                          <span className="dashboard-offer-terms">
                            {terms}
                            <span>
                              {offer.status === 'COUNTERED'
                                ? 'Ada penawaran balik'
                                : 'Menunggu responsmu'}
                            </span>
                          </span>

                          <time dateTime={offer.expiresAt}>
                            Batas tanggapan{' '}
                            {new Date(offer.expiresAt).toLocaleString('id-ID', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </time>
                        </span>

                        <ArrowUpRight size={18} aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="dashboard-empty">
                <CheckCheck size={22} aria-hidden="true" />
                <div>
                  <strong>Belum ada yang perlu ditanggapi.</strong>
                  <p>Penawaran yang menunggu keputusanmu akan muncul di sini.</p>
                </div>
              </div>
            )}

            <Link className="account-activity-footer" href="/app/penawaran">
              Lihat penawaran <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </section>

          <section
            className="account-activity dashboard-messages"
            aria-labelledby="dashboard-messages"
          >
            <div className="account-activity-heading">
              <div className="dashboard-section-title">
                <MessageCircle size={20} aria-hidden="true" />
                <h2 id="dashboard-messages">Pesan baru</h2>
              </div>
            </div>

            {messages.isPending ? (
              <AccountSkeleton />
            ) : messages.isError ? (
              <AccountError retry={() => messages.refetch()}>
                Pesan gagal dimuat.
              </AccountError>
            ) : unreadMessages.length > 0 ? (
              <ul className="dashboard-task-list">
                {unreadMessages.slice(0, 3).map(conversation => (
                  <li key={conversation.id}>
                    <ChatLink
                      className="dashboard-message-link"
                      conversationId={conversation.id}
                    >
                      <ProfileAvatar
                        photoUrl={null}
                        displayName={conversation.participant.displayName}
                        className="dashboard-participant"
                      />

                      <span>
                        <strong>{conversation.participant.displayName}</strong>
                        <small>{conversation.listingTitle}</small>
                        <span className="dashboard-message-count">
                          {conversation.unreadCount} belum dibaca
                        </span>
                      </span>

                      <ChevronRight size={16} aria-hidden="true" />
                    </ChatLink>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="dashboard-empty">
                <MessageCircle size={22} aria-hidden="true" />
                <div>
                  <strong>Belum ada pesan baru.</strong>
                  <p>Percakapanmu tetap tersimpan di halaman Pesan.</p>
                </div>
              </div>
            )}

            <ChatLink className="account-activity-footer">
              Buka pesan <ChevronRight size={15} aria-hidden="true" />
            </ChatLink>
          </section>
        </div>

        <DashboardNotifications />

        {!noItems && recentItems}
      </div>
    </div>
  );
}