'use client';

import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { useSession } from '@/lib/session';
import { useChat } from './context';

export function ChatTrigger({ floating = false, onOpen }: { floating?: boolean; onOpen?: () => void }) {
  const session = useSession(), chat = useChat(), pathname = usePathname();
  if (session.state !== 'AUTHENTICATED' || pathname === '/pesan' || pathname.startsWith('/pesan/') || pathname === '/app/pesan' || pathname.startsWith('/app/pesan/')) return null;
  return <button type="button" className={floating ? 'chat-launcher' : 'header-icon-link chat-navbar-trigger'} aria-label={chat.count ? `Buka pesan, ${chat.count} belum dibaca` : 'Buka pesan'} aria-haspopup="dialog" aria-expanded={chat.isOpen} aria-controls="global-chat-dialog" title="Pesan" onClick={() => { onOpen?.(); chat.open(); }}>
    <MessageCircle size={floating ? 23 : 19} strokeWidth={1.7} aria-hidden="true" />{floating && <span>Pesan</span>}
    {!!chat.count && <span className="chat-unread-badge" aria-hidden="true">{chat.count > 99 ? '99+' : chat.count}</span>}
  </button>;
}
