'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { ActiveListing } from './shared';

export function ListingPhoto({ listing, className = '', loading = 'lazy' }: {
  listing: ActiveListing;
  className?: string;
  loading?: 'lazy' | 'eager';
}) {
  const photo = listing.revision.media[0];
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!photo?.url || failedUrl === photo.url) {
    return <div className={`${className} market-photo-empty`} role="img" aria-label={`Foto ${listing.revision.title} belum tersedia`}>
      <ImageOff size={28} strokeWidth={1.4} aria-hidden="true" /><span>Foto belum tersedia</span>
    </div>;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={photo.url} alt={`Foto ${listing.revision.title}`} loading={loading} decoding="async" onError={() => setFailedUrl(photo.url ?? null)} />;
}
