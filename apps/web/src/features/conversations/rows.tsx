'use client';

import type { ConversationDto } from '@valora/contracts';
import Link from 'next/link';
import { ProfileAvatar } from '../profile/avatar';

export function ConversationRows({ rows, activeId }: { rows: ConversationDto[]; activeId?: string }) {
  return <div className="conversation-list">{rows.map((row) => <Link className="conversation-row" href={`/app/pesan/${row.id}`} key={row.id} aria-current={row.id === activeId ? 'page' : undefined}><ProfileAvatar photoUrl={row.participant.profilePhotoUrl} displayName={row.participant.displayName} className="conversation-avatar" /><div className="conversation-row-copy"><div><strong>{row.participant.displayName}</strong><span className="meta">{new Date(row.updatedAt).toLocaleDateString('id-ID')}</span></div><small>{row.listingTitle}</small><p>{row.lastMessage?.body ?? 'Mulai percakapan tentang barang ini.'}</p></div>{row.unreadCount > 0 && <span className="unread-count" aria-label={`${row.unreadCount} pesan belum dibaca`}>{row.unreadCount}</span>}</Link>)}</div>;
}
