'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Camera } from 'lucide-react';

export function PrivatePhoto({ mediaId, alt, className }: { mediaId?: string; alt: string; className?: string }) {
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => { if (!mediaId) return; let active = true; api<{ url: string }>(`/media/${mediaId}/access`).then((value) => { if (active) setImage({ id: mediaId, url: value.url }); }).catch(() => { if (active) setImage(null); }); return () => { active = false; }; }, [mediaId]);
  // Signed owner-only URLs require the browser session cookie; Next's image optimizer cannot fetch them.
  // eslint-disable-next-line @next/next/no-img-element
  return image?.id === mediaId && image?.url ? <img src={image.url} alt={alt} className={className} onError={() => setImage(null)} /> : <div className={[className, 'private-photo-placeholder'].filter(Boolean).join(' ')} role="img" aria-label={`Foto belum tersedia: ${alt}`}><Camera size={26} strokeWidth={1.5} aria-hidden="true" /></div>;
}
