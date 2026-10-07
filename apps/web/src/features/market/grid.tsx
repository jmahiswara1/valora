'use client';

import type { PublicListingDto } from '@valora/contracts';
import { FavoriteScope } from '../favorites/hooks';
import { MarketCard } from './card';

export function MarketGrid({ listings, className = 'catalog-grid', busy = false }: { listings: PublicListingDto[]; className?: string; busy?: boolean }) {
  const rows = listings.filter(row => row.status === 'ACTIVE');
  return <FavoriteScope listingIds={rows.map(row => row.id)}><div className={className} aria-busy={busy}>{rows.map(row => <MarketCard listing={row} key={row.id} />)}</div></FavoriteScope>;
}
