'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import Link from 'next/link';
import type { ConversationDto } from '@valora/contracts';
import { api } from '@/lib/api';
import { AccountSkeleton } from '../account/skeleton';
import { AccountError } from '../account/error';
import { ConversationRows } from './rows';

export function ConversationPane({ activeId }: { activeId?: string }) {
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const conversations = useQuery({ queryKey: ['conversations'], queryFn: () => api<ConversationDto[]>('/conversations'), refetchInterval: 10_000 });
  const query = search.trim().toLocaleLowerCase('id-ID');
  const rows = conversations.data ?? [];
  const filtered = rows.filter(row => (!unreadOnly || row.unreadCount > 0) && (!query || `${row.participant.displayName} ${row.listingTitle}`.toLocaleLowerCase('id-ID').includes(query)));

  return <aside className="account-conversation-pane" aria-label="Daftar percakapan">
    <div className="conversation-pane-heading">
      {activeId ? <h2>Pesan</h2> : <h1>Pesan</h1>}
      <p>Bicarakan kondisi dan serah terima barang.</p>
      <div className="conversation-search">
        <Search size={18} aria-hidden="true" />
        <input type="search" aria-label="Cari percakapan" placeholder="Cari nama atau barang…" value={search} onChange={event => setSearch(event.target.value)} />
        {search && <button type="button" className="account-icon-button" aria-label="Hapus pencarian" onClick={() => setSearch('')}><X size={17} aria-hidden="true" /></button>}
      </div>
      <div className="conversation-filters" role="group" aria-label="Filter percakapan">
        <button type="button" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>Semua</button>
        <button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Belum dibaca</button>
      </div>
    </div>
    <div className="conversation-scroll" tabIndex={0} aria-label="Percakapan">
      {conversations.isPending ? <AccountSkeleton /> : conversations.isError ? <AccountError retry={() => conversations.refetch()}>Percakapan gagal dimuat.</AccountError> : !rows.length ? <div className="conversation-empty"><h3>Belum ada percakapan.</h3><p>Buka barang di Market dan pilih “Tanya pemilik” untuk memulai.</p><Link href="/market" className="button button-secondary">Jelajahi Market</Link></div> : filtered.length ? <ConversationRows rows={filtered} activeId={activeId} /> : <div className="conversation-empty"><h3>Tidak ada percakapan yang cocok.</h3><p>Coba nama atau barang lain, atau tampilkan semua percakapan.</p><button type="button" className="button button-secondary" onClick={() => { setSearch(''); setUnreadOnly(false); }}>Hapus filter</button></div>}
    </div>
  </aside>;
}
