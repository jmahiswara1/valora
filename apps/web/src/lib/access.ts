'use client';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
export function useExpiringAccess(expiresAt: string | null, prefix: string, id: string) {
  const cache = useQueryClient(); const [expired, setExpired] = useState<string | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const expire = () => { if (Date.parse(expiresAt) <= Date.now()) { setExpired(expiresAt); void cache.cancelQueries({ queryKey: [prefix, id] }); cache.removeQueries({ queryKey: [prefix, id] }); } };
    const timer = setTimeout(expire, Math.max(0, Date.parse(expiresAt) - Date.now()));
    const denied = (event: Event) => { if ((event as CustomEvent<string>).detail.includes(id)) { setExpired(expiresAt); void cache.cancelQueries({ queryKey: [prefix, id] }); cache.removeQueries({ queryKey: [prefix, id] }); } };
    window.addEventListener('valora-access-error', denied); window.addEventListener('pageshow', expire); document.addEventListener('visibilitychange', expire);
    return () => { clearTimeout(timer); window.removeEventListener('valora-access-error', denied); window.removeEventListener('pageshow', expire); document.removeEventListener('visibilitychange', expire); };
  }, [cache, expiresAt, prefix, id]);
  return Boolean(expiresAt && expired !== expiresAt);
}
