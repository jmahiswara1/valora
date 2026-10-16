'use client';
import { CashSettlement } from '@/features/exchange/settlement';
import { HandoverPanel } from '@/features/handover/panel';
import { TransactionTimeline } from '@/features/handover/timeline';
import { TransactionReviews } from '@/features/reviews/transaction';

import { Select } from '@/components/ui/select';

import type { DisputeDto, EvidenceDto, TransactionDto } from '@valora/contracts';
import { useMe } from '@/lib/session';
import { useQueryClient, useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useCriticalAction } from '../../hooks/use-critical-action';
import { api, apiEnvelope, ApiClientError } from '@/lib/api';
import { useState } from 'react';
import { Notice, Field, Button } from "../../components/ui/primitives";
import { ActionFeedback } from '../../components/ui/action-feedback';
import { AccountSkeleton } from '../account/skeleton';
import Link from 'next/link';
import { TransactionHistoryActions } from './history-actions';
import { TransactionReport } from './report-form';
import { PrivatePhoto } from '../items/photo';
import { ConfirmAction } from '../../components/ui/confirm-dialog';
import { EvidenceList } from './evidence';
import { transactionLabels } from './labels';
import { money, time } from './shared';

function ParticipantCase({ record, conversationId }: { record: DisputeDto; conversationId: string | null }) {
  const me = useMe(); const cache = useQueryClient(); const action = useCriticalAction('case:' + record.id, me.data?.id ?? '');
  const detail = useQuery({ queryKey: ['case', record.id], queryFn: () => api<DisputeDto & { evidence: EvidenceDto[] }>(`/cases/${record.id}`), refetchInterval: 10000, retry: false });
  const messages = useInfiniteQuery({ queryKey: ['case-messages', conversationId], enabled: Boolean(conversationId && record.status !== 'RESOLVED'), initialPageParam: null as string | null, queryFn: ({ pageParam }) => apiEnvelope<import('@valora/contracts').MessageDto[]>(`/conversations/${conversationId}/messages${pageParam ? '?before=' + encodeURIComponent(pageParam) : ''}`), getNextPageParam: (p) => p.meta?.nextCursor ?? undefined });
  const [note, setNote] = useState(''); const [messageId, setMessageId] = useState(''); const [files, setFiles] = useState<File[]>([]); const [uploadError, setUploadError] = useState(''); const [uploading, setUploading] = useState(false);
  const [ticketIds, setTicketIds] = useState<string[] | null>(null);
  const busy = uploading || action.pending;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setUploading(true); setUploadError('');
    try {
      if (files.length > 4) throw new Error('Maksimal empat foto per pengajuan.');
      const ids = ticketIds ?? [];
      if (!ticketIds) {
        for (const file of files) {
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error('Gunakan JPEG, PNG, atau WebP maksimal 8 MiB.');
          const ticket = await api<{ ticketId: string }>(`/cases/${record.id}/media/tickets`, { method: 'POST', body: { fileName: file.name, mime: file.type, bytes: file.size, purpose: 'CASE_EVIDENCE' } });
          await api(`/media/uploads/${ticket.ticketId}`, { method: 'PUT', body: file }); ids.push(ticket.ticketId);
        }
        setTicketIds(ids);
      }
      const result = await action.run<EvidenceDto>(`/cases/${record.id}/evidence`, { ...(note.trim() ? { note: note.trim() } : {}), ...(messageId ? { messageId } : {}), ticketIds: ids });
      if (result) { setNote(''); setMessageId(''); setFiles([]); setTicketIds(null); await cache.invalidateQueries({ queryKey: ['case', record.id] }); }
    } catch (cause) { setUploadError(cause instanceof Error ? cause.message : 'Foto belum berhasil diunggah.'); }
    finally { setUploading(false); }
  }
  return <section className="app-panel form-stack"><span className="eyebrow">KASUS / {record.status === 'RESOLVED' ? 'SELESAI' : 'TERBUKA'}</span><h2>Sengketa dan bukti</h2><p>{record.reason}</p>{record.resolution && <Notice>Putusan: {record.resolution} · {record.resolutionReason}</Notice>}{detail.isPending ? <p role="status">Memuat bukti…</p> : detail.isError ? <Notice kind="error">Bukti tidak dapat dimuat.</Notice> : <EvidenceList evidence={detail.data.evidence} />}
    {record.status !== 'RESOLVED' && <form className="form-stack" onSubmit={submit}><h3>Tambahkan bukti privat</h3><p>Catatan, pesan, dan foto hanya terlihat oleh peserta serta admin kasus yang berhak.</p><Field label="Catatan bukti" htmlFor={'evidence-note-' + record.id}><textarea id={'evidence-note-' + record.id} className="textarea" maxLength={3000} value={note} disabled={busy || action.hasSaved()} onChange={(e) => { setNote(e.target.value); }} /></Field>
      <Field label="Pesan dari percakapan terkait (opsional)" htmlFor={'evidence-message-' + record.id}><Select id={'evidence-message-' + record.id} className="select" value={messageId} disabled={busy || action.hasSaved()} onChange={(e) => setMessageId(e.target.value)}><option value="">Tanpa pesan</option>{messages.data?.pages.flatMap((p) => p.data).map((m) => <option key={m.id} value={m.id}>{m.body.slice(0, 90) || `${m.attachments?.length ?? 1} foto dalam percakapan`}</option>)}</Select></Field>{messages.hasNextPage && <Button type="button" variant="quiet" onClick={() => messages.fetchNextPage()}>Muat pesan sebelumnya</Button>}
      <Field label="Foto bukti (maksimal empat)" htmlFor={'evidence-files-' + record.id} hint="JPEG, PNG, WebP; maksimal 8 MiB per foto."><input id={'evidence-files-' + record.id} type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || action.hasSaved()} onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setTicketIds(null); }} /></Field>{uploadError && <Notice kind="error">{uploadError}</Notice>}<Button type="submit" disabled={busy}>{busy ? 'Menyimpan bukti…' : 'Simpan bukti'}</Button><ActionFeedback action={action} onRecovered={() => { setNote(''); setMessageId(''); setFiles([]); setTicketIds(null); }} /></form>}
  </section>;
}

export function TransactionDetail({ id }: { id: string }) {
  const me = useMe(); const action = useCriticalAction('transaction:' + id, me.data?.id ?? '');
  const detail = useQuery({ queryKey: ['transaction', id], queryFn: () => api<TransactionDto>(`/transactions/${id}`), refetchInterval: 10000, retry: false });
  const [confirm, setConfirm] = useState<{ itemId: string; kind: 'HANDED_OVER' | 'RECEIVED' } | null>(null);
  const [cancelResponse, setCancelResponse] = useState<boolean | null>(null);
  const [reason, setReason] = useState(''); const [mode, setMode] = useState<'cancel' | 'dispute' | null>(null);
  if (detail.isPending) return <AccountSkeleton />;
  if (detail.isError || !detail.data) return <Notice kind="error">{detail.error instanceof ApiClientError && detail.error.status === 404 ? 'Transaksi tidak ditemukan atau kamu tidak berhak membukanya.' : 'Transaksi gagal dimuat.'} <Button variant="quiet" onClick={() => detail.refetch()}>Coba lagi</Button></Notice>;
  const row = detail.data; const userId = me.data?.id; const active = !['COMPLETED', 'CANCELLED'].includes(row.status); const involved = userId === row.sellerOrDonorId || userId === row.buyerOrRecipientId;
  const pendingCancel = row.cancellations.find((c) => c.status === 'PENDING');
  const confirmItem = row.snapshot.items.find((i) => i.id === confirm?.itemId);
  const party = (id: string) => row.snapshot.parties.find((p) => p.id === id)?.displayName ?? 'Peserta';
  return <><Link className="back-link" href="/app/transaksi">← Semua transaksi</Link><div className="app-heading"><div><span className="eyebrow">KESEPAKATAN / {row.type}</span><h1>{row.snapshot.items[0].title}</h1><p>{party(row.sellerOrDonorId)} dan {party(row.buyerOrRecipientId)}</p></div><span className="badge">{transactionLabels[row.status]}</span></div><ActionFeedback action={action} />{row.correctedAt && <Notice>Riwayat transaksi ini telah dikoreksi melalui putusan admin. Status formal tetap selesai.</Notice>}
    <div className="transaction-layout"><div className="transaction-main"><section className="app-panel"><h2>Barang dalam kesepakatan</h2>{row.corrections?.map((c) => <p key={c.id}><Link href={`/app/koreksi/${c.id}`}>Kasus koreksi {c.id.slice(0, 8)} · {c.status} →</Link></p>)}{!active && row.status === 'COMPLETED' && involved && !row.corrections?.some((c) => ['OPEN', 'IN_REVIEW'].includes(c.status)) && <TransactionHistoryActions transactionId={row.id} version={row.version} />}{active && involved && <details className="operations-detail"><summary>Laporkan transaksi</summary><TransactionReport transactionId={row.id} /></details>}{row.snapshot.items.map((item) => <article className="transaction-item" key={item.id}><PrivatePhoto mediaId={item.mediaIds[0]} alt={'Foto ' + item.title} /><div><h3>{item.title}</h3><p className="preserve-lines">{item.description}</p><p>{item.conditionSummary}</p><small>{party(item.fromUserId)} → {party(item.toUserId)}</small></div></article>)}{row.finalPriceIdr !== null && <p className="transaction-price">Harga final <strong>{money(row.finalPriceIdr)}</strong></p>}</section>
      {involved && <HandoverPanel transaction={row} />}<CashSettlement transaction={row} userId={userId} action={action} />
      <section className="app-panel"><h2>Konfirmasi serah terima</h2><p>Konfirmasikan hanya setelah Anda benar-benar menyerahkan atau menerima barang.</p>{row.type === 'RESELL' && <Notice>Pembayaran dilakukan langsung antar pengguna. Valora tidak memverifikasi pembayaran atau menyediakan pengembalian dana.</Notice>}
        <div className="confirmation-list">{row.requiredConfirmations.map((expected) => { const done = row.confirmations.find((c) => c.actorId === expected.actorId && c.itemId === expected.itemId && c.kind === expected.kind); const item = row.snapshot.items.find((i) => i.id === expected.itemId)!; const label = `${expected.kind === 'HANDED_OVER' ? 'Menyerahkan' : 'Menerima'} ${item.title}`; return <div className="confirmation-row" key={expected.actorId + expected.itemId + expected.kind}><div><strong>{party(expected.actorId)}</strong><p>{label}</p>{done && <small>{time(done.confirmedAt)}</small>}</div>{done ? <span className="badge">Sudah dikonfirmasi</span> : involved && expected.actorId === userId && active && row.status !== 'DISPUTED' ? <Button disabled={action.pending} onClick={() => setConfirm({ itemId: expected.itemId, kind: expected.kind })}>Konfirmasi {expected.kind === 'HANDED_OVER' ? 'penyerahan' : 'penerimaan'}</Button> : <span className="meta">{row.status === 'DISPUTED' ? 'Ditahan selama sengketa' : active ? 'Menunggu pihak ini' : 'Tidak dikonfirmasi'}</span>}</div>; })}</div>
        {row.status === 'COMPLETED' && <Notice kind="success">Kepemilikan telah berpindah. {row.resolutionOrigin === 'ADMIN_AUTHORIZED' ? 'Transaksi diselesaikan melalui putusan admin.' : 'Konfirmasi para pihak telah lengkap.'}</Notice>}{row.status === 'CANCELLED' && <Notice>Reservasi telah dilepas. Kepemilikan barang tidak berubah.</Notice>}
      </section>{involved && <TransactionTimeline transaction={row} />}{row.status === 'COMPLETED' && involved && <TransactionReviews id={row.id} />}{row.disputes.map((record) => involved ? <ParticipantCase key={record.id} record={record} conversationId={row.conversationId} /> : null)}
    </div><aside className="transaction-side"><section className="app-panel form-stack"><span className="eyebrow">TARGET SERAH TERIMA</span><h2>{time(row.targetHandoverAt)}</h2><p>Kesepakatan dibuat {time(row.acceptedAt)}. Metode tersedia: {row.snapshot.handoverMethods.map((m) => m === 'MEETUP' ? 'Bertemu langsung' : 'Pengiriman').join(', ')}.</p>{row.overdueAt && active && <Notice>Target terlewati. Transaksi masuk antrean tindak lanjut admin; kepemilikan belum berubah.</Notice>}{row.conversationId && involved && <Link href={`/app/pesan/${row.conversationId}`} className="button button-secondary">Buka percakapan</Link>}
      {involved && active && row.status !== 'DISPUTED' && <><Button variant="secondary" disabled={Boolean(pendingCancel) || action.pending} onClick={() => { setMode('cancel'); setReason(''); }}>Minta pembatalan</Button><Button variant="quiet" disabled={action.pending} onClick={() => { setMode('dispute'); setReason(''); }}>Buka sengketa</Button></>}
      {pendingCancel && <div className="form-stack"><h3>Permintaan pembatalan</h3><p>{party(pendingCancel.requestedById)}: {pendingCancel.reason}</p><p>Konfirmasi tetap tersedia sampai sengketa dibuka.</p>{pendingCancel.requestedById !== userId && involved && row.status !== 'DISPUTED' && <><Button variant="danger" disabled={action.pending} onClick={() => setCancelResponse(true)}>Setujui pembatalan</Button><Button variant="secondary" disabled={action.pending} onClick={() => setCancelResponse(false)}>Tolak pembatalan</Button></>}</div>}
      {row.cancellations.filter((c) => c.status !== 'PENDING').map((c) => <p key={c.id} className="meta">Pembatalan: {c.status === 'ACCEPTED' ? 'disetujui' : 'ditutup/ditolak'} · {c.endReason}</p>)}
    </section></aside></div>
    {cancelResponse !== null && pendingCancel && <ConfirmAction title={cancelResponse ? 'Setujui pembatalan transaksi' : 'Tolak pembatalan transaksi'} buttonLabel="Simpan respons" pending={action.pending} onClose={() => setCancelResponse(null)} onConfirm={async () => { const result = await action.run(`/transactions/${id}/cancellation-requests/${pendingCancel.id}/respond`, { expectedVersion: row.version, accept: cancelResponse }); if (result) setCancelResponse(null); }}><p>{cancelResponse ? 'Reservasi dilepas tanpa memindahkan kepemilikan barang.' : 'Permintaan pembatalan ditutup. Proses konfirmasi tetap tersedia.'}</p><p>{pendingCancel.reason}</p><ActionFeedback action={action} onRecovered={() => setCancelResponse(null)} /></ConfirmAction>}
    {confirm && <ConfirmAction title={`${confirm.kind === 'HANDED_OVER' ? 'Konfirmasi penyerahan' : 'Konfirmasi penerimaan'} ${confirmItem?.title}`} buttonLabel="Simpan konfirmasi" pending={action.pending} onClose={() => setConfirm(null)} onConfirm={async () => { const result = await action.run(`/transactions/${id}/confirmations`, { itemId: confirm.itemId, kind: confirm.kind, expectedVersion: row.version }); if (result) setConfirm(null); }}><p>Pastikan Anda benar-benar telah {confirm.kind === 'HANDED_OVER' ? 'menyerahkan' : 'menerima'} barang ini. Kepemilikan berubah setelah seluruh konfirmasi lengkap.</p><ActionFeedback action={action} onRecovered={() => { setConfirm(null); setMode(null); }} /></ConfirmAction>}
    {mode && <ConfirmAction title={mode === 'cancel' ? 'Minta pembatalan transaksi' : 'Buka sengketa transaksi'} buttonLabel={mode === 'cancel' ? 'Kirim permintaan batal' : 'Buka sengketa'} pending={action.pending} onClose={() => setMode(null)} onConfirm={async () => { const result = await action.run(`/transactions/${id}/${mode === 'cancel' ? 'cancellation-requests' : 'disputes'}`, { expectedVersion: row.version, reason: reason.trim() }); if (result) setMode(null); }}><p>{mode === 'cancel' ? 'Pembatalan memerlukan persetujuan pihak lain. Konfirmasi tetap tersedia selama menunggu.' : 'Sengketa menahan penyelesaian otomatis sampai putusan admin.'}</p><Field label="Alasan" htmlFor="transaction-action-reason"><textarea className="textarea" id="transaction-action-reason" value={reason} minLength={5} maxLength={1000} required disabled={action.pending || action.hasSaved()} onChange={(e) => setReason(e.target.value)} /></Field><ActionFeedback action={action} onRecovered={() => { setConfirm(null); setMode(null); }} /></ConfirmAction>}
  </>;
}
