'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { FavoriteStatusDto } from '@valora/contracts';
import { useSession } from '@/lib/session';
import { api } from '@/lib/api';

type FavoriteState = { saved: Map<string, boolean>; loading: boolean; failed: boolean };
const Context = createContext<FavoriteState | null>(null);

export function FavoriteScope({ listingIds, knownSaved = false, children }: { listingIds: string[]; knownSaved?: boolean; children: ReactNode }) {
  const session = useSession();
  const userId = session.session?.user?.id;
  const ids = [...new Set(listingIds)].sort();
  const enabled = session.state === 'AUTHENTICATED' && ids.length > 0 && !knownSaved;
  const status = useQuery({
    queryKey: ['favorites', userId, 'status', ids], enabled,
    queryFn: async () => {
      const batches: Promise<FavoriteStatusDto[]>[] = [];
      for (let i = 0; i < ids.length; i += 100) batches.push(api<FavoriteStatusDto[]>(`/me/favorites/status?${new URLSearchParams({ listingIds: ids.slice(i, i + 100).join(',') })}`));
      return (await Promise.all(batches)).flat();
    },
    staleTime: 15_000, refetchOnWindowFocus: true,
  });
  const value = { saved: new Map(knownSaved ? ids.map(id => [id, true] as const) : status.data?.map(row => [row.listingId, row.isFavorite])),
    loading: enabled && status.isPending, failed: enabled && status.isError };
  return <Context.Provider value={value}>{children}
    {value.failed && <div className="favorite-status-error" role="alert">Status Favorit belum dapat dimuat. <button type="button" className="link-button" onClick={() => status.refetch()}>Coba lagi</button></div>}
    {session.state === 'UNAVAILABLE' && <div className="favorite-status-error" role="status">Sesi belum dapat diperiksa. <button type="button" className="link-button" onClick={() => session.refresh()}>Coba lagi</button></div>}
  </Context.Provider>;
}

export function useFavoriteState() {
  const state = useContext(Context);
  if (!state) throw new Error('FavoriteScope missing');
  return state;
}
