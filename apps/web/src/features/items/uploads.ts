'use client';

import { useRef } from 'react';
import { api } from '@/lib/api';

type Ticket = { ticketId: string; expiresAt: string };

// File objects belong to this form instance. Neither references nor tickets are persisted.
export function useItemUploads(itemId?: string) {
  const ready = useRef(new Map<File, Ticket>());
  const pending = useRef(new Map<File, Promise<Ticket>>());
  async function upload(file: File): Promise<string> {
    const previous = ready.current.get(file);
    if (previous && Date.parse(previous.expiresAt) > Date.now() + 10_000) return previous.ticketId;
    let task = pending.current.get(file);
    if (!task) {
      task = (async () => {
        const ticket = await api<Ticket & { uploadUrl: string }>(itemId ? `/items/${itemId}/media/tickets` : '/media/tickets', {
          method: 'POST', body: { fileName: file.name, mime: file.type, bytes: file.size },
        });
        await api(ticket.uploadUrl.replace('/api/v1', ''), { method: 'PUT', body: file, timeoutMs: 60_000 });
        ready.current.set(file, ticket);
        return ticket;
      })();
      pending.current.set(file, task);
    }
    try { return (await task).ticketId; }
    finally { pending.current.delete(file); }
  }
  return { upload, consumed: (file: File) => ready.current.delete(file) };
}

export function photoError(files: File[], stored = 0) {
  if (files.length + stored > 8) return 'Maksimal delapan foto per barang.';
  if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 8 * 1024 * 1024)) return 'Gunakan JPEG, PNG, atau WebP, masing-masing maksimal 8 MiB.';
  return '';
}
