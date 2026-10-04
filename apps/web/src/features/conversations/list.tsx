'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ConversationDto } from '@valora/contracts';
import { AccountHeading } from '../account/heading';
import { AccountSkeleton } from '../account/skeleton';
import { AccountError } from '../account/error';
import Link from 'next/link';
import { ConversationRows } from './rows';

export function ConversationsPage() {
  const rows = useQuery({ queryKey: ['conversations'], queryFn: () => api<ConversationDto[]>('/conversations'), refetchInterval: 10_000 });
  return <><AccountHeading title="Pesan" description="Bicarakan kondisi dan serah terima barang dengan pemiliknya." />{rows.isPending ? <AccountSkeleton /> : rows.isError ? <AccountError retry={() => rows.refetch()}>Percakapan gagal dimuat.</AccountError> : rows.data.length ? <div className="account-message-workspace"><aside className="account-conversation-pane" aria-label="Daftar percakapan"><ConversationRows rows={rows.data} /></aside><section className="account-chat-placeholder"><h2>Pilih percakapan.</h2><p>Pesan dan detail barang akan tampil di sini. Kesepakatan tetap dicatat lewat penawaran.</p></section></div> : <div className="empty-state"><h3>Belum ada percakapan.</h3><p>Buka barang di Market dan pilih “Tanya pemilik” untuk memulai.</p><Link href="/market" className="button button-secondary">Jelajahi Market</Link></div>}</>;
}
