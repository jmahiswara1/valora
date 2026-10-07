'use client';

import { useIsMutating, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { ApiSuccess, NotificationCenterDto, NotificationSummaryDto } from '@valora/contracts';
import { api, ApiClientError } from '@/lib/api';
import { useSession } from '@/lib/session';

export function useNotificationSummary() {
  const session = useSession(), userId = session.session?.user?.id;
  return useQuery({ queryKey: ['notification-center', userId, 'summary'], queryFn: () => api<NotificationSummaryDto>('/me/notifications/summary'),
    enabled: session.state === 'AUTHENTICATED' && Boolean(userId), staleTime: 15000, refetchInterval: 30000, refetchOnWindowFocus: true, refetchOnReconnect: true });
}

export function notificationHref(row: NotificationCenterDto) {
  return row.target.kind === 'CONVERSATION' ? `/app/pesan/${row.target.id}` : row.target.kind === 'LISTING' ? `/market/${row.target.id}` : row.target.kind === 'OFFER' ? `/app/penawaran/${row.target.id}` : `/app/transaksi/${row.target.id}`;
}

export function useNotificationRead() {
  const session = useSession(), userId = session.session?.user?.id, cache = useQueryClient();
  const prefix = ['notification-center', userId];
  const pending = useIsMutating({ mutationKey: [...prefix, 'read'] }) > 0;
  const mutation = useMutation({ mutationKey: [...prefix, 'read'], retry: false,
    mutationFn: (input: { id: string; throughSequence?: number }) => api<{ read: boolean; readAt: string | null; count?: number }>(input.id === 'all' ? '/me/notifications/read-all' : `/me/notifications/${input.id}/read`, { method: 'POST', body: input.id === 'all' ? undefined : { throughSequence: input.throughSequence } }),
    onMutate: async () => { await cache.cancelQueries({ queryKey: prefix }); },
    onSuccess: async (result, input) => {
      const id = input.id;
      if (!cache.getMutationCache().findAll({ mutationKey: [...prefix, 'read'], status: 'pending' }).length) return;
      window.dispatchEvent(new CustomEvent('valora-notification-feedback', { detail: '' }));
      const update = (row: NotificationCenterDto) => result.read && (id === 'all' || row.id === id) && !row.readAt ? { ...row, readAt: result.readAt } : row;
      cache.setQueriesData<InfiniteData<ApiSuccess<NotificationCenterDto[]>>>({ queryKey: [...prefix, 'list'] }, data => data ? { ...data, pages: data.pages.map(page => ({ ...page, data: page.data.map(update) })) } : data);
      await cache.invalidateQueries({ queryKey: prefix });
    },
    onError: async error => {
      if (!cache.getMutationCache().findAll({ mutationKey: [...prefix, 'read'], status: 'pending' }).length) return;
      if (!(error instanceof ApiClientError) || !['SESSION_CHANGED', 'UNAUTHENTICATED', 'ACCOUNT_SUSPENDED'].includes(error.code))
        window.dispatchEvent(new CustomEvent('valora-notification-feedback', { detail: 'Notifikasi belum dapat ditandai dibaca. Coba lagi dari pusat notifikasi.' }));
      await cache.invalidateQueries({ queryKey: prefix });
    },
  });
  function read(id: string, throughSequence?: number) {
    if (session.state !== 'AUTHENTICATED') return;
    const running = cache.getMutationCache().findAll({ mutationKey: [...prefix, 'read'], status: 'pending' });
    if (running.some(row => { const variables = row.state.variables as { id: string } | undefined; return variables?.id === id || variables?.id === 'all'; }) || (id === 'all' && running.length)) return;
    mutation.mutate({ id, throughSequence });
  }
  return { read, pending };
}
