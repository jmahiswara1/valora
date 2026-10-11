'use client';

import { useQueryClient, useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useMe } from '@/lib/session';
import { useState, useRef, useLayoutEffect } from 'react';
import { api, apiEnvelope } from '@/lib/api';
import type { ConversationDto, MessageDto } from '@valora/contracts';
import { AccountSkeleton } from '../account/skeleton';
import { AccountError } from '../account/error';
import { Notice, Field } from "../../components/ui/primitives";
import Link from 'next/link';
import { ProfileAvatar } from '../profile/avatar';
import { ConfirmAction } from '../../components/ui/confirm-dialog';
import { ConversationPane } from './pane';
import { ChatComposer } from './composer';
import { MessagePhotos } from './photos';
import { useVisibleMessages } from './read';
import { useConversationRealtime } from '@/lib/realtime';
import { ArrowLeft, Ban, Flag, Check, CheckCheck } from 'lucide-react';

export function ConversationThread({ id }: { id: string }) {
  return <Thread key={id} id={id} />;
}

function Thread({ id }: { id: string }) {
  const cache = useQueryClient(); const me = useMe();
  const [sendError, setSendError] = useState(''); const realtime = useConversationRealtime(); const [notice, setNotice] = useState('');
  const [tool, setTool] = useState<'report' | 'block' | 'message' | null>(null); const [reportReason, setReportReason] = useState(''); const [toolBusy, setToolBusy] = useState(false); const toolRunning = useRef(false);
  const [reportedMessage, setReportedMessage] = useState<string | null>(null);
  const scroll = useRef<HTMLElement>(null); const nearBottom = useRef(true); const historyAnchor = useRef<{ height: number; top: number } | null>(null);
  const viewportHeight = useRef(0);
  const thread = useInfiniteQuery({ queryKey: ['conversation-messages', id], initialPageParam: undefined as string | undefined, queryFn: ({ pageParam }) => apiEnvelope<MessageDto[]>(`/conversations/${id}/messages?limit=30${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''}`), getNextPageParam: (page) => page.meta?.nextCursor ?? undefined, refetchInterval: realtime ? false : 5_000 });
  const detail = useQuery({ queryKey: ['conversation', id], queryFn: () => api<ConversationDto>(`/conversations/${id}`), refetchInterval: realtime ? false : 5000 });
  const conversation = detail.data;
  const messages = thread.data?.pages.slice().reverse().flatMap((page) => page.data) ?? [];
  useVisibleMessages(id, scroll, messages.map(message => message.id).join(',') + (conversation ? ':ready' : ':pending'), conversation?.readSequence ?? 0);
  const lastMessageId = messages.at(-1)?.id;
  useLayoutEffect(() => { const element = scroll.current; if (!element) return; if (historyAnchor.current) { element.scrollTop = historyAnchor.current.top + element.scrollHeight - historyAnchor.current.height; historyAnchor.current = null; } else if (nearBottom.current) element.scrollTop = element.scrollHeight; }, [messages.length, lastMessageId, conversation?.id]);
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const keepPosition = () => {
      viewportHeight.current = element.clientHeight;
      if (nearBottom.current && !historyAnchor.current) element.scrollTop = element.scrollHeight;
    };
    const observer = new ResizeObserver(keepPosition);
    observer.observe(element);
    return () => observer.disconnect();
  }, [conversation?.id]);
  async function older() { if (thread.isFetchingNextPage) return; if (scroll.current) historyAnchor.current = { top: scroll.current.scrollTop, height: scroll.current.scrollHeight }; const result = await thread.fetchNextPage(); if (result.isError) historyAnchor.current = null; }
  async function sent() {
    nearBottom.current = true;
    await Promise.all([cache.invalidateQueries({ queryKey: ['conversation-messages', id] }), cache.invalidateQueries({ queryKey: ['conversations'] }), cache.invalidateQueries({ queryKey: ['conversation', id] })]);
  }
  async function runTool() { if (!conversation || !tool || toolRunning.current) return; toolRunning.current = true; setToolBusy(true); setSendError(''); try { if (tool === 'block') { await api('/blocks', { method: 'POST', body: { userId: conversation.participant.id } }); setNotice('Akun diblokir. Riwayat percakapan tetap tersimpan.'); } else { await api('/reports', { method: 'POST', body: { targetType: tool === 'message' ? 'MESSAGE' : 'USER', targetId: tool === 'message' ? reportedMessage : conversation.participant.id, reasonCode: 'CHAT_CONDUCT', details: reportReason.trim() } }); setNotice('Laporan terkirim untuk ditinjau.'); } setTool(null); } catch (cause) { setSendError(cause instanceof Error ? cause.message : 'Tindakan belum tersimpan. Coba lagi.'); } finally { toolRunning.current = false; setToolBusy(false); } }
  if (detail.isPending || detail.isError || !conversation) return <div className="account-message-workspace has-thread"><ConversationPane activeId={id} /><div className="chat-thread-state"><Link href="/app/pesan" className="back-link"><ArrowLeft size={18} aria-hidden="true" /> Semua percakapan</Link>{detail.isPending ? <AccountSkeleton /> : detail.isError ? <AccountError retry={() => detail.refetch()}>Percakapan gagal dimuat.</AccountError> : <Notice kind="error">Percakapan tidak ditemukan.</Notice>}</div></div>;
  return <div className="account-message-workspace has-thread"><ConversationPane activeId={id} /><div className="chat-page">
    <header className="chat-header">
      <Link href="/app/pesan" className="back-link chat-back"><ArrowLeft size={18} aria-hidden="true" /> Semua percakapan</Link>
      <div className="chat-heading"><div className="chat-identity"><Link className="chat-participant" href={`/profil/${conversation.participant.id}`} prefetch={false} aria-label={`Buka profil ${conversation.participant.displayName}`}><ProfileAvatar photoUrl={conversation.participant.profilePhotoUrl} displayName={conversation.participant.displayName} className="chat-profile-avatar" /><span>{conversation.participant.displayName}</span></Link></div><div className="chat-tools"><button type="button" className="button button-quiet button-small" aria-label="Laporkan akun" title="Laporkan akun" onClick={() => { setSendError(''); setReportReason(''); setTool('report'); }}><Flag size={18} aria-hidden="true" /><span>Laporkan akun</span></button><button type="button" className="button button-quiet button-small" aria-label="Blokir" title="Blokir" onClick={() => { setSendError(''); setTool('block'); }}><Ban size={18} aria-hidden="true" /><span>Blokir</span></button></div></div>
      <h1 className="chat-listing-title" title={conversation.listingTitle}>{conversation.listingTitle}</h1>
      <div className="chat-context">{!realtime && <p className="meta" role="status">Percakapan diperbarui otomatis. Pesan tetap dapat dikirim.</p>}{conversation.transactionId && <Link href={`/app/transaksi/${conversation.transactionId}`} className="button button-secondary chat-agreement">Buka kesepakatan</Link>}</div>
      {notice && <Notice kind="success">{notice}</Notice>}
    </header>
    <section ref={scroll} className="chat-messages" aria-label="Histori pesan" aria-live="polite" onScroll={() => { const element = scroll.current; if (element && element.clientHeight === viewportHeight.current) nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }}>{thread.isPending ? <AccountSkeleton /> : thread.isError && !messages.length ? <AccountError retry={() => thread.refetch()}>Histori pesan gagal dimuat.</AccountError> : <>{thread.isFetchNextPageError && <Notice kind="error">Pesan sebelumnya gagal dimuat. Riwayat yang sudah terbuka tetap tersedia.</Notice>}{thread.hasNextPage && <button type="button" className="button button-quiet" onClick={older} disabled={thread.isFetchingNextPage}>{thread.isFetchingNextPage ? 'Memuat pesan…' : thread.isFetchNextPageError ? 'Coba muat pesan lagi' : 'Muat pesan sebelumnya'}</button>}{messages.length ? messages.map((entry) => { const mine = entry.senderId === me.data?.id; return <article key={entry.id} data-sequence={entry.sequence} data-message-id={entry.id} className={`chat-message ${mine ? 'chat-message-mine' : ''}`}><MessagePhotos photos={entry.attachments} />{entry.body && <p>{entry.body}</p>}<div className="chat-message-footer"><small>{new Date(entry.sentAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</small>{mine ? <span className="chat-message-receipt" role="img" aria-label={entry.sequence > 0 && entry.sequence <= conversation.peerReadSequence ? 'Dibaca' : 'Terkirim'}>{entry.sequence > 0 && entry.sequence <= conversation.peerReadSequence ? <CheckCheck size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}</span> : <button type="button" className="chat-message-report" aria-label="Laporkan pesan ini" onClick={() => { setReportedMessage(entry.id); setReportReason(''); setSendError(''); setTool('message'); }}><Flag size={15} aria-hidden="true" /></button>}</div></article>; }) : <div className="chat-empty">Belum ada pesan. Tanyakan hal yang perlu diketahui tentang barang ini.</div>}</>}</section>
    <footer className="chat-footer">
      {sendError && !tool && <Notice kind="error">{sendError}</Notice>}
      <ChatComposer id={id} onSent={sent} />
      <p className="chat-footnote">Pesan bukan persetujuan transaksi. Harga, syarat, dan penerimaan dicatat melalui penawaran.</p>
    </footer>
    {tool && <ConfirmAction title={tool === 'block' ? `Blokir ${conversation.participant.displayName}` : tool === 'message' ? 'Laporkan pesan' : 'Laporkan akun'} buttonLabel={tool === 'block' ? 'Blokir akun' : 'Kirim laporan'} pending={toolBusy} onClose={() => setTool(null)} onConfirm={runTool}>{tool === 'block' ? <p>Pesan baru dari kedua pihak akan dibatasi. Riwayat percakapan tetap tersimpan.</p> : <Field label="Alasan laporan" htmlFor="chat-report"><textarea className="textarea" id="chat-report" required minLength={5} maxLength={1000} value={reportReason} disabled={toolBusy} onChange={(e) => setReportReason(e.target.value)} /></Field>}{sendError && <Notice kind="error">{sendError}</Notice>}</ConfirmAction>}
  </div></div>;
}
