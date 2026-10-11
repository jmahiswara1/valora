'use client';

import type { ConversationDto } from '@valora/contracts';
import Link from 'next/link';
import { ProfileAvatar } from '../profile/avatar';

export function ConversationRows({ rows, activeId }: { rows: ConversationDto[]; activeId?: string }) {
  return <div className="conversation-list">{rows.map((row) => <Link className={`conversation-row${row.unreadCount > 0 ? ' has-unread' : ''}`} href={`/app/pesan/${row.id}`} scroll={false} key={row.id} aria-current={row.id === activeId ? 'page' : undefined}><ProfileAvatar photoUrl={row.participant.profilePhotoUrl} displayName={row.participant.displayName} className="conversation-avatar" /><div className="conversation-row-copy"><div><strong title={row.participant.displayName}>{row.participant.displayName}</strong><time className="meta" dateTime={row.updatedAt}>{new Date(row.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</time></div><small title={row.listingTitle}>{row.listingTitle}</small><p>{(row.lastMessage ? row.lastMessage.body || `${row.lastMessage.attachments?.length ?? 1} foto` : null) ?? 'Mulai percakapan tentang barang ini.'}</p></div>{row.unreadCount > 0 && <span className="unread-count" aria-label={`${row.unreadCount} pesan belum dibaca`}>{row.unreadCount > 99 ? '99+' : row.unreadCount}</span>}</Link>)}</div>;
}
