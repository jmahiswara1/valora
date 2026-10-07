'use client';

import { useQuery } from '@tanstack/react-query';
import type { PassportDto } from '@valora/contracts';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

export function usePassport(itemId: string, owner = false, enabled = true) {
  const session = useSession();
  const userId = session.session?.user?.id;
  return useQuery({
    queryKey: ['passport', owner ? 'owner' : 'public', owner ? userId : null, itemId],
    queryFn: () => api<PassportDto>(owner ? `/items/${itemId}/passport` : `/passport/${itemId}`),
    enabled: enabled && (!owner || (session.state === 'AUTHENTICATED' && Boolean(userId))),
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}
