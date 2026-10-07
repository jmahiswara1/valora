'use client';

import Link from 'next/link';
import { ArrowUpRight, MessageCircle, Search, Bell, Check, Handshake, ReceiptText } from 'lucide-react';
import type { NotificationCenterDto } from '@valora/contracts';
import { notificationHref, useNotificationRead } from './hooks';

export function NotificationRow({ row, compact = false, onNavigate, onRead }: { row: NotificationCenterDto; compact?: boolean; onNavigate?: () => void; onRead?: () => void }) {
  const { read, pending } = useNotificationRead();
  const Icon = row.category === 'messages' ? MessageCircle : row.category === 'market' ? Search : row.type === 'HANDOVER_REMINDER' ? Bell : row.category === 'offers' ? Handshake : ReceiptText;
  const fullTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.createdAt));
  function markRead() { if (!row.readAt) { onRead?.(); read(row.id, row.latestMessageSequence); } }
  return <li className={`notification-entry${!row.readAt ? ' is-unread' : ''}${compact ? ' is-compact' : ''}`} data-notification-id={row.id}>
    <Link className="notification-entry-link" href={notificationHref(row)} prefetch={false} onClick={event => {
      if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { markRead(); onNavigate?.(); }
    }}>
      <span className="notification-category-icon"><Icon size={19} strokeWidth={1.7} aria-hidden="true" /></span>
      <div className="notification-entry-content"><div className="notification-entry-title"><strong>{row.title}</strong>{!row.readAt && <span className="notification-unread-label">Baru</span>}</div>
        <span className="notification-item-title">{row.itemTitle}</span>{!compact && <p>{row.message}</p>}<time dateTime={row.createdAt} title={fullTime}>{fullTime}</time>
      </div><ArrowUpRight className="notification-entry-arrow" size={16} aria-hidden="true" />
    </Link>
    {!compact && !row.readAt && <button type="button" className="notification-read-button" aria-label={`Tandai ${row.title} untuk ${row.itemTitle} dibaca`} disabled={pending} onClick={markRead}><Check size={18} aria-hidden="true" /><span>Tandai dibaca</span></button>}
  </li>;
}
