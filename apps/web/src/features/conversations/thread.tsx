'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient, useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useMe } from '@/lib/session';
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { api, apiEnvelope, ApiClientError } from '@/lib/api';
import type { ConversationDto, MessageDto } from '@valora/contracts';
import { AccountSkeleton } from '../account/skeleton';
import { AccountError } from '../account/error';
import { Notice, Button, Field } from "../../components/ui/primitives";
import Link from 'next/link';
import { ProfileAvatar } from '../profile/avatar';
import { ConfirmAction } from '../../components/ui/confirm-dialog';
import { ConversationRows } from './rows';

export function ConversationThread({ id }: { id: string }) {
  const router = useRouter(); const cache = useQueryClient(); const me = useMe();
  const [body, setBody] = useState(''); const [sendError, setSendError] = useState(''); const [sending, setSending] = useState(false); const [realtime, setRealtime] = useState(false); const [notice, setNotice] = useState('');
  const [tool, setTool] = useState<'report' | 'block' | null>(null); const [reportReason, setReportReason] = useState(''); const [toolBusy, setToolBusy] = useState(false); const toolRunning = useRef(false);
  const sendRunning = useRef(false); const retryIntent = useRef<{ body: string; id: string } | null>(null);
  const scroll = useRef<HTMLElement>(null); const nearBottom = useRef(true); const historyAnchor = useRef<{ height: number; top: number } | null>(null);
  const conversations = useQuery({ queryKey: ['conversations'], queryFn: () => api<ConversationDto[]>('/conversations'), refetchInterval: 10_000 });
  const thread = useInfiniteQuery({ queryKey: ['conversation-messages', id], initialPageParam: undefined as string | undefined, queryFn: ({ pageParam }) => apiEnvelope<MessageDto[]>(`/conversations/${id}/messages?limit=30${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''}`), getNextPageParam: (page) => page.meta?.nextCursor ?? undefined, refetchInterval: realtime ? false : 5_000 });
  const conversation = conversations.data?.find((row) => row.id === id);
  useEffect(() => {
    const source = new EventSource('/api/v1/conversations/stream', { withCredentials: true });
    source.onopen = () => { setRealtime(true); void cache.invalidateQueries({ queryKey: ['conversation-messages', id] }); void cache.invalidateQueries({ queryKey: ['conversations'] }); };
    source.onerror = () => setRealtime(false);
    const onConversation = (event: MessageEvent) => {
      try { const data = JSON.parse(event.data) as { conversationId: string }; if (data.conversationId === id) { void cache.invalidateQueries({ queryKey: ['conversation-messages', id] }); void cache.invalidateQueries({ queryKey: ['conversations'] }); void api(`/conversations/${id}/read`, { method: 'POST' }).catch(() => {}); } } catch { /* Event metadata is intentionally small. */ }
    };
    source.addEventListener('conversation', onConversation);
    return () => { source.removeEventListener('conversation', onConversation); source.close(); };
  }, [id, cache]);
  useEffect(() => { void api(`/conversations/${id}/read`, { method: 'POST' }).then(() => cache.invalidateQueries({ queryKey: ['conversations'] })).catch(() => {}); }, [id, cache]);
  const messages = thread.data?.pages.slice().reverse().flatMap((page) => page.data) ?? [];
  const lastMessageId = messages.at(-1)?.id;
  useLayoutEffect(() => { const element = scroll.current; if (!element) return; if (historyAnchor.current) { element.scrollTop = historyAnchor.current.top + element.scrollHeight - historyAnchor.current.height; historyAnchor.current = null; } else if (nearBottom.current) element.scrollTop = element.scrollHeight; }, [messages.length, lastMessageId]);
  async function older() { if (thread.isFetchingNextPage) return; if (scroll.current) historyAnchor.current = { top: scroll.current.scrollTop, height: scroll.current.scrollHeight }; const result = await thread.fetchNextPage(); if (result.isError) historyAnchor.current = null; }
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const text = body.trim(); if (!text || sendRunning.current) return;
    sendRunning.current = true; setSending(true); setSendError('');
    const intent = retryIntent.current?.body === text ? retryIntent.current : { body: text, id: crypto.randomUUID() }; retryIntent.current = intent;
    try { await api<MessageDto>(`/conversations/${id}/messages`, { method: 'POST', body: { clientMessageId: intent.id, body: text } }); setBody(''); retryIntent.current = null; nearBottom.current = true; await cache.invalidateQueries({ queryKey: ['conversation-messages', id] }); await cache.invalidateQueries({ queryKey: ['conversations'] }); await api(`/conversations/${id}/read`, { method: 'POST' }).catch(() => {}); }
    catch (cause) { if (cause instanceof ApiClientError && cause.status === 401) { router.push('/masuk?next=' + encodeURIComponent(`/app/pesan/${id}`)); return; } setSendError(cause instanceof Error ? cause.message : 'Pesan belum terkirim. Coba lagi.'); }
    finally { sendRunning.current = false; setSending(false); }
  }
  async function runTool() { if (!conversation || !tool || toolRunning.current) return; toolRunning.current = true; setToolBusy(true); setSendError(''); try { if (tool === 'block') { await api('/blocks', { method: 'POST', body: { userId: conversation.participant.id } }); setNotice('Akun diblokir. Riwayat percakapan tetap tersimpan.'); } else { await api('/reports', { method: 'POST', body: { targetType: 'USER', targetId: conversation.participant.id, reasonCode: 'CHAT_CONDUCT', details: reportReason.trim() } }); setNotice('Laporan terkirim untuk ditinjau.'); } setTool(null); } catch (cause) { setSendError(cause instanceof Error ? cause.message : 'Tindakan belum tersimpan. Coba lagi.'); } finally { toolRunning.current = false; setToolBusy(false); } }
  if (conversations.isPending) return <AccountSkeleton />;
  if (conversations.isError) return <AccountError retry={() => conversations.refetch()}>Percakapan gagal dimuat.</AccountError>;
  if (!conversation) return <Notice kind="error">Percakapan tidak ditemukan. <Link href="/app/pesan">Kembali ke Pesan</Link></Notice>;
  return <div className="account-message-workspace has-thread"><aside className="account-conversation-pane" aria-label="Daftar percakapan"><h2>Pesan</h2><ConversationRows rows={conversations.data} activeId={id} /></aside><div className="chat-page"><div className="chat-heading"><Link href="/app/pesan" className="back-link">← Semua percakapan</Link><div><div><h1>{conversation.listingTitle}</h1></div><div className="chat-participant"><ProfileAvatar photoUrl={conversation.participant.profilePhotoUrl} displayName={conversation.participant.displayName} className="chat-profile-avatar" /><p>{conversation.participant.displayName}</p></div></div><div className="chat-tools"><button type="button" className="button button-quiet button-small" onClick={() => { setSendError(''); setReportReason(''); setTool('report'); }}>Laporkan akun</button><button type="button" className="button button-quiet button-small" onClick={() => { setSendError(''); setTool('block'); }}>Blokir</button></div></div>
    {conversation.transactionId && <Link href={`/app/transaksi/${conversation.transactionId}`} className="button button-secondary">Buka kesepakatan transaksi</Link>}
    {!realtime && <p className="meta" role="status">Percakapan diperbarui otomatis. Pesan tetap dapat dikirim.</p>}
    {notice && <Notice kind="success">{notice}</Notice>}
    <section ref={scroll} className="chat-messages" aria-label="Histori pesan" aria-live="polite" onScroll={() => { const element = scroll.current; if (element) nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }}>{thread.isPending ? <AccountSkeleton /> : thread.isError && !messages.length ? <AccountError retry={() => thread.refetch()}>Histori pesan gagal dimuat.</AccountError> : <>{thread.isFetchNextPageError && <Notice kind="error">Pesan sebelumnya gagal dimuat. Riwayat yang sudah terbuka tetap tersedia.</Notice>}{thread.hasNextPage && <button type="button" className="button button-quiet" onClick={older} disabled={thread.isFetchingNextPage}>{thread.isFetchingNextPage ? 'Memuat pesan…' : thread.isFetchNextPageError ? 'Coba muat pesan lagi' : 'Muat pesan sebelumnya'}</button>}{messages.length ? messages.map((entry) => { const mine = entry.senderId === me.data?.id; return <article key={entry.id} className={`chat-message ${mine ? 'chat-message-mine' : ''}`}><p>{entry.body}</p><small>{mine ? 'Kamu' : conversation.participant.displayName} · {new Date(entry.sentAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</small></article>; }) : <div className="chat-empty">Belum ada pesan. Tanyakan hal yang perlu diketahui tentang barang ini.</div>}</>}</section>
    {sendError && !tool && <Notice kind="error">{sendError}</Notice>}
    <form className="chat-composer" onSubmit={send} aria-busy={sending}><label className="sr-only" htmlFor="message-body">Pesan</label><textarea id="message-body" value={body} disabled={sending} onChange={(e) => { setBody(e.target.value); retryIntent.current = null; }} maxLength={2000} placeholder="Tulis pesan…" required /><Button type="submit" disabled={sending || !body.trim()}>{sending ? 'Mengirim…' : 'Kirim'}</Button></form>
    <p className="chat-footnote">Pesan bukan persetujuan transaksi. Harga, syarat, dan penerimaan dicatat melalui penawaran.</p>
    {tool && <ConfirmAction title={tool === 'block' ? `Blokir ${conversation.participant.displayName}` : 'Laporkan akun'} buttonLabel={tool === 'block' ? 'Blokir akun' : 'Kirim laporan'} pending={toolBusy} onClose={() => setTool(null)} onConfirm={runTool}>{tool === 'block' ? <p>Pesan baru dari kedua pihak akan dibatasi. Riwayat percakapan tetap tersimpan.</p> : <Field label="Alasan laporan" htmlFor="chat-report"><textarea className="textarea" id="chat-report" required minLength={5} maxLength={1000} value={reportReason} disabled={toolBusy} onChange={(e) => setReportReason(e.target.value)} /></Field>}{sendError && <Notice kind="error">{sendError}</Notice>}</ConfirmAction>}
  </div></div>;
}
