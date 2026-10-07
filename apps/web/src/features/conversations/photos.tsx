'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, X, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import type { MessageAttachmentDto, MessagePhotoScope } from '@valora/contracts';
import { api } from '@/lib/api';

function Photo({ photo, scope, large = false }: { photo: MessageAttachmentDto; scope: MessagePhotoScope; large?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined), refreshTried = useRef(false);
  const query = useQuery({ queryKey: ['message-photo', photo.id, scope.scopeType, scope.scopeId], queryFn: () => api<{ url: string }>(`/message-photos/${photo.id}/access?${new URLSearchParams(scope as Record<string, string>)}`), refetchOnMount: 'always', staleTime: 240_000, refetchInterval: 240_000, retry: false });
  const url = query.data?.url;
  return <span className={`message-photo-frame${large ? ' is-large' : ''}`} style={{ aspectRatio: `${photo.width || 4} / ${photo.height || 3}` }}>
    {url && url !== failedUrl ? /* Signed photos must be fetched with the current browser session. */
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="Foto dalam percakapan" width={photo.width} height={photo.height} onError={() => { setFailedUrl(url); if (!refreshTried.current) { refreshTried.current = true; void query.refetch(); } }} />
      : <span className="message-photo-unavailable"><Camera size={24} aria-hidden="true" /><span>{query.isFetching ? 'Memuat foto…' : 'Foto belum tersedia'}</span>{(url === failedUrl || query.isError) && <span className="message-photo-retry" role="status">Tutup lalu muat ulang foto.</span>}</span>}
  </span>;
}

export function MessagePhotos({ photos = [], scope = {} }: { photos?: MessageAttachmentDto[]; scope?: MessagePhotoScope }) {
  const [selected, setSelected] = useState<number | null>(null), [version, setVersion] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const open = selected !== null;
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { trigger?.focus(); };
  }, [open]);
  if (!photos.length) return null;
  return <><div className="message-photos">{photos.map((photo, index) => <button type="button" className="message-photo-open" key={photo.id} aria-label={`Buka foto ${index + 1} dari ${photos.length}`} onClick={() => setSelected(index)}><Photo photo={photo} scope={scope} /></button>)}</div>
    {selected !== null && <dialog className="message-photo-dialog" ref={dialog} aria-label="Foto dalam percakapan" onCancel={() => setSelected(null)} onKeyDown={event => { if (event.key === 'ArrowLeft') setSelected(value => Math.max(0, (value ?? 0) - 1)); if (event.key === 'ArrowRight') setSelected(value => Math.min(photos.length - 1, (value ?? 0) + 1)); }}>
      <div className="message-photo-toolbar"><span>Foto {selected + 1} dari {photos.length}</span><button className="chat-icon-button" aria-label="Muat ulang foto" onClick={() => setVersion(value => value + 1)}><RotateCw size={19} /></button><button className="chat-icon-button" autoFocus aria-label="Tutup foto" onClick={() => setSelected(null)}><X size={22} /></button></div>
      <Photo key={`${photos[selected].id}:${version}`} photo={photos[selected]} scope={scope} large />
      {photos.length > 1 && <div className="message-photo-navigation"><button className="chat-icon-button" aria-label="Foto sebelumnya" disabled={selected === 0} onClick={() => setSelected(value => (value ?? 1) - 1)}><ChevronLeft /></button><button className="chat-icon-button" aria-label="Foto berikutnya" disabled={selected === photos.length - 1} onClick={() => setSelected(value => (value ?? 0) + 1)}><ChevronRight /></button></div>}
    </dialog>}
  </>;
}
