'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Maximize2, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { ChatContext } from './context';
import { ChatTrigger } from './trigger';
import { ConversationsPage } from './list';
import { ConversationThread } from './thread';
import { ChatVerificationNotice } from './verification';

export function ChatProvider({ children }: { children: ReactNode }) {
  const session = useSession(), pathname = usePathname(), router = useRouter();
  const [openedAt, setOpenedAt] = useState<string | null>(null), [selectedId, setSelectedId] = useState<string>();
  if (openedAt !== null && openedAt !== pathname) setOpenedAt(null);
  const authenticated = session.state === 'AUTHENTICATED' && session.verifiedPath === pathname;
  const isChatPage = pathname === '/pesan' || pathname.startsWith('/pesan/');
  const isOpen = authenticated && openedAt === pathname && !isChatPage;
  const unread = useQuery({ queryKey: ['conversation-unread'], queryFn: () => api<{ count: number }>('/conversations/unread-count'), enabled: authenticated, staleTime: 10_000, refetchInterval: 30_000, refetchOnWindowFocus: true });
  const count = !unread.isError && Number.isSafeInteger(unread.data?.count) ? unread.data?.count : undefined;
  const close = useCallback(() => setOpenedAt(null), []);
  const open = useCallback((id?: string) => {
    if (!authenticated) return;
    if (isChatPage) { router.push(id ? `/pesan/${id}` : '/pesan'); return; }
    setSelectedId(id); setOpenedAt(pathname);
  }, [authenticated, isChatPage, pathname, router]);
  const value = useMemo(() => ({ open, close, isOpen, count }), [open, close, isOpen, count]);
  return <ChatContext.Provider value={value}>{children}<ChatTrigger floating />{isOpen && <ChatModal key={pathname} selectedId={selectedId} onSelect={setSelectedId} onClose={close} />}</ChatContext.Provider>;
}

function ChatModal({ selectedId, onSelect, onClose }: { selectedId?: string; onSelect: (id?: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current, opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialog} id="global-chat-dialog" className="chat-dialog" aria-labelledby="chat-dialog-title" onCancel={event => { if (event.target === event.currentTarget) { event.preventDefault(); onClose(); } }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <header className="chat-window-toolbar"><h2 id="chat-dialog-title">Pesan</h2><div>
      <Link href={selectedId ? `/pesan/${selectedId}` : '/pesan'} className="chat-icon-button" aria-label="Buka halaman chat penuh" title="Buka halaman chat penuh" onClick={onClose}><Maximize2 size={19} aria-hidden="true" /></Link>
      <button type="button" className="chat-icon-button" aria-label="Tutup chat" title="Tutup chat" autoFocus onClick={onClose}><X size={21} aria-hidden="true" /></button>
    </div></header>
    <div className="chat-surface chat-modal-content"><ChatVerificationNotice />{selectedId ? <ConversationThread id={selectedId} onSelect={onSelect} /> : <ConversationsPage onSelect={onSelect} />}</div>
  </dialog>;
}
