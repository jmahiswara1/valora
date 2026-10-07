'use client';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SavedSearchDto, SavedSearchCreateInput, SavedSearchUpdateInput } from '@valora/contracts';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

export function useSavedSearches() {
  const session = useSession(), userId = session.session?.user?.id;
  return useQuery({ queryKey: ['saved-searches', userId, 'list'], queryFn: () => api<SavedSearchDto[]>('/me/saved-searches'), enabled: session.state === 'AUTHENTICATED' && Boolean(userId), refetchOnWindowFocus: true, refetchOnReconnect: true });
}
type Action = { kind: 'create'; input: SavedSearchCreateInput } | { kind: 'update'; id: string; input: SavedSearchUpdateInput } | { kind: 'remove'; id: string };
export function useSearchActions() {
  const userId = useSession().session?.user?.id, cache = useQueryClient(), key = ['saved-searches', userId];
  const pending = useIsMutating({ mutationKey: [...key, 'change'] }) > 0;
  const mutation = useMutation<SavedSearchDto | { removed: boolean }, Error, Action>({ mutationKey: [...key, 'change'], retry: false,
    mutationFn: (action: Action) => action.kind === 'create' ? api<SavedSearchDto>('/me/saved-searches', { method: 'POST', body: action.input }) : action.kind === 'update' ? api<SavedSearchDto>(`/me/saved-searches/${action.id}`, { method: 'PATCH', body: action.input }) : api<{ removed: boolean }>(`/me/saved-searches/${action.id}`, { method: 'DELETE' }),
    onMutate: () => cache.cancelQueries({ queryKey: key }),
    onSettled: () => cache.invalidateQueries({ queryKey: key }),
  });
  return { ...mutation, pending };
}
