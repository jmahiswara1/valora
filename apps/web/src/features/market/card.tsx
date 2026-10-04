'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { ActiveListing } from './shared';
import { listingMoney, listingTypeLabel, listingConditionLabel } from './labels';
import { ListingPhoto } from './photo';

export function MarketCard({ listing }: { listing: ActiveListing }) {
  const revision = listing.revision;
  const price = listing.type === 'RESELL'
    ? revision.askingPriceIdr === null ? 'Harga belum tersedia' : listingMoney(revision.askingPriceIdr)
    : listing.type === 'DONATE' ? 'Tanpa biaya' : 'Tukar barang';

  return <Link href={`/market/${listing.id}`} className="market-card">
    <div className="market-card-image"><ListingPhoto listing={listing} /></div>
    <div className="market-card-content">
      <div className="market-card-kicker"><span>{listingTypeLabel[listing.type]}</span><span>{revision.categoryName}</span></div>
      <h3 title={revision.title}>{revision.title}</h3>
      <p className="market-card-description">{revision.conditionDisclosure}</p>
      <div className="market-card-bottom">
        <div><strong>{price}</strong><small><span className="market-card-condition">{listingConditionLabel(revision.condition)} · </span><span className="market-card-city">{revision.city.name}</span></small></div>
        <span className="market-card-arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
      </div>
    </div>
  </Link>;
}
