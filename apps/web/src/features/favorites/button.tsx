'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMutation, useIsMutating, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { ApiSuccess, FavoriteDto, FavoriteStatusDto } from '@valora/contracts';
import { api, ApiClientError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { FavoriteScope, useFavoriteState } from './hooks';

export function FavoriteButton({ listingId, title, variant = 'icon', allowSave = true, onRemoved, onFailure }: {
  listingId: string; title: string; variant?: 'icon' | 'text'; allowSave?: boolean; onRemoved?: () => void; onFailure?: (message: string) => void;
}) {
  const router = useRouter(); const session = useSession(); const state = useFavoriteState();
  const client = useQueryClient(); const userId = session.session?.user?.id;
  const [feedback, setFeedback] = useState(''); const [failed, setFailed] = useState(false);
  const mutationKey = ['favorites', userId, 'mutation', listingId];
  const pending = useIsMutating({ mutationKey }) > 0;
  const saved = state.saved.get(listingId) ?? false;
  const authenticated = session.state === 'AUTHENTICATED';
  const ready = authenticated && !state.loading && !state.failed;
  const mutation = useMutation({
    mutationKey, retry: false,
    onMutate: async () => { await client.cancelQueries({ queryKey: ['favorites', userId, 'status'] }); },
    mutationFn: (desired: boolean) => api<FavoriteStatusDto>(`/me/favorites/${listingId}`, { method: desired ? 'PUT' : 'DELETE' }),
    onSuccess: result => {
      client.setQueriesData<FavoriteStatusDto[]>({ queryKey: ['favorites', userId, 'status'] }, old => old?.map(row => row.listingId === listingId ? result : row));
      if (!result.isFavorite) {
        client.setQueriesData<InfiniteData<ApiSuccess<FavoriteDto[]>>>({ queryKey: ['favorites', userId, 'list'] }, old => old && ({ ...old, pages: old.pages.map(page => ({ ...page, data: page.data.filter(row => row.listingId !== listingId) })) }));
        onRemoved?.();
      }
      void client.invalidateQueries({ queryKey: ['favorites', userId, 'list'] });
      setFailed(false); setFeedback(result.isFavorite ? 'Disimpan ke Favorit.' : 'Dihapus dari Favorit.');
    },
    onError: cause => {
      const message = cause instanceof ApiClientError ? cause.message : 'Favorit belum dapat diperbarui. Coba lagi.';
      setFailed(true); setFeedback(message); onFailure?.(message);
      void client.invalidateQueries({ queryKey: ['favorites', userId] });
    },
  });
  const disabled = pending || (!authenticated && session.state !== 'GUEST') || (authenticated && !ready) || (!saved && !allowSave);
  const label = pending ? 'Memperbarui Favorit' : authenticated && !ready ? 'Status Favorit belum tersedia' : saved ? 'Hapus dari Favorit' : 'Simpan ke Favorit';
  return <>
    <button type="button" className={`favorite-button favorite-button--${variant}`} data-listing-id={listingId}
      disabled={disabled} aria-pressed={ready ? saved : undefined} aria-label={`${label}: ${title}`} title={label}
      onClick={() => {
        if (disabled || client.isMutating({ mutationKey })) return;
        if (session.state === 'GUEST') { router.push('/masuk?next=' + encodeURIComponent(`/market/${listingId}`)); return; }
        setFeedback(''); setFailed(false); mutation.mutate(!saved);
      }}>
      <Heart size={19} strokeWidth={1.7} fill={ready && saved ? 'currentColor' : 'none'} aria-hidden="true" />
      {variant === 'text' && <span>{pending ? 'Memperbarui…' : saved ? 'Tersimpan di Favorit' : 'Simpan ke Favorit'}</span>}
    </button>
    {feedback && <p className={failed ? 'favorite-feedback' : 'favorite-announcement'} role={failed ? 'alert' : 'status'}>{feedback}</p>}
  </>;
}

export function ListingFavorite({ listingId, title, allowSave = true }: { listingId: string; title: string; allowSave?: boolean }) {
  return <FavoriteScope listingIds={[listingId]}><div className="detail-favorite"><FavoriteButton listingId={listingId} title={title} variant="text" allowSave={allowSave} /></div></FavoriteScope>;
}
