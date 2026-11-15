'use client';

import type { OfferDto } from '@valora/contracts';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { money } from '../market/process-shared';
import { listingTypeLabel } from '../market/labels';
import { offerPhase, offerStatusLabel } from './phase';

export function OfferListRow({ offer, userId, now }: { offer: OfferDto; userId: string; now: number }) {
  const phase = offerPhase(offer, userId, now);
  const isBidder = offer.bidderId === userId;
  const revision = offer.currentRevision;
  const terms = revision?.exchangeTerms;
  const cash = terms?.cashAdjustment;
  const expired = phase === 'finished' && ['PENDING', 'COUNTERED'].includes(offer.status);
  const transaction = offer.status === 'ACCEPTED' && offer.transactionId;
  const detailUrl = `/app/penawaran/${offer.id}`;
  const titleId = `offer-title-${offer.id}`;
  const status = expired ? 'Kedaluwarsa'
    : !revision && phase !== 'finished' ? 'Rincian belum tersedia'
    : phase === 'response' ? 'Perlu tanggapan'
    : phase === 'waiting' ? 'Menunggu balasan'
    : offerStatusLabel[offer.status];
  const nextStep = transaction ? 'Lihat progres dan serah terima di halaman transaksi.'
    : offer.status === 'ACCEPTED' ? 'Penawaran diterima. Buka detail untuk melihat kelanjutannya.'
    : expired ? 'Tenggat tanggapan sudah lewat.'
    : offer.status === 'EXPIRED' ? 'Penawaran sudah berakhir dan tidak dapat ditanggapi.'
    : offer.status === 'WITHDRAWN' ? isBidder ? 'Kamu telah menarik penawaran ini.' : 'Penawar telah menarik penawaran ini.'
    : offer.status === 'REJECTED' ? 'Penawaran ini tidak dilanjutkan.'
    : !revision ? 'Buka detail untuk memeriksa rincian terbaru.'
    : phase === 'response' ? 'Periksa rincian, lalu tentukan tanggapanmu.'
    : 'Belum perlu tindakan. Penawaran sedang menunggu balasan.';
  const value = offer.listing.type === 'DONATE' ? 'Tanpa biaya'
    : offer.listing.type === 'EXCHANGE' ? cash ? money(cash.amountIdr) : 'Tanpa tambahan uang'
    : revision?.priceIdr == null ? 'Nominal belum tersedia' : money(revision.priceIdr);

  return <article className="offer-list-row" data-offer-id={offer.id} data-phase={phase} aria-labelledby={titleId}>
    <div className="offer-row-main">
      <div className="offer-row-copy">
        <h2 id={titleId}>{offer.listing.title}</h2>
        <div className="offer-row-meta">
          <span>{isBidder ? 'Penawaran keluar' : 'Penawaran masuk'}</span>
          <span>{listingTypeLabel[offer.listing.type]}</span>
          {revision && <span>Revisi {revision.revisionNo}</span>}
        </div>
        {revision?.message && <p className="offer-row-message"><span>Pesan terakhir: </span>{revision.message}</p>}
        {terms ? <p className="offer-row-exchange">Dari kamu: {isBidder ? terms.bidderItems.length : terms.ownerItems.length} barang · Dari pihak lain: {isBidder ? terms.ownerItems.length : terms.bidderItems.length} barang</p>
          : offer.exchangeSnapshot && <p className="offer-row-exchange">Barang penukar: {offer.exchangeSnapshot.title}</p>}
      </div>
      <div className="offer-row-value">
        <strong>{value}</strong>
        {offer.listing.type === 'EXCHANGE' && cash && <p>Tambahan dari {(cash.payer === 'BIDDER') === isBidder ? 'kamu' : 'pihak lain'}</p>}
        <span className="offer-row-status" data-status={expired ? 'EXPIRED' : offer.status} data-phase={phase}>{status}</span>
        {phase !== 'finished' && <time dateTime={offer.expiresAt}>Batas tanggapan {new Date(offer.expiresAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</time>}
      </div>
    </div>
    <div className="offer-row-footer">
      <p className="offer-row-next">{nextStep}</p>
      <div className="offer-row-actions">
        {transaction ? <>
          <Link href={detailUrl} className="button button-secondary">Lihat detail</Link>
          <Link href={`/app/transaksi/${transaction}`} className="button button-primary">Buka transaksi <ArrowRight size={16} aria-hidden="true" /></Link>
        </> : <Link href={detailUrl} className={`button ${phase === 'response' ? 'button-primary' : 'button-secondary'}`}>
          {phase === 'response' ? 'Tinjau penawaran' : 'Lihat detail'} <ArrowRight size={16} aria-hidden="true" />
        </Link>}
      </div>
    </div>
  </article>;
}
