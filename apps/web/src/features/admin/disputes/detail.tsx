'use client';

import { Select } from '@/components/ui/select';

import { useMe } from '@/lib/session';
import { useCriticalAction } from '../../../hooks/use-critical-action';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api, apiEnvelope } from '@/lib/api';
import type { DisputeDto, TransactionDto, EvidenceDto } from '@valora/contracts';
import { useState } from 'react';
import { useExpiringAccess } from '@/lib/access';
import { Notice, Button, Field } from "../../../components/ui/primitives";
import Link from 'next/link';
import { ActionFeedback } from '../../../components/ui/action-feedback';
import { transactionLabels } from '../../transactions/labels';
import { EvidenceList } from '../../transactions/evidence';
import { ConfirmAction } from '../../../components/ui/confirm-dialog';

export function DisputeAdminDetail({ id }: { id: string }) {
  const me = useMe(); const action = useCriticalAction('admin-case:' + id, me.data?.id ?? '');
  const detail = useQuery({ queryKey: ['admin-case', id], queryFn: () => api<DisputeDto & { transaction: TransactionDto | null }>(`/admin/disputes/${id}`), refetchInterval: 10000, retry: false });
  const [accessReason, setAccessReason] = useState(''); const [evidenceGrant, setEvidenceGrant] = useState<string | null>(null); const [chatGrant, setChatGrant] = useState<string | null>(null);
  const evidenceActive = useExpiringAccess(evidenceGrant, 'admin-evidence', id); const chatActive = useExpiringAccess(chatGrant, 'admin-case-messages', id);
  const evidence = useQuery({ queryKey: ['admin-evidence', id, evidenceGrant], queryFn: () => api<EvidenceDto[]>(`/admin/cases/${id}/evidence`), enabled: evidenceActive, refetchInterval: 10000, retry: false });
  const messages = useInfiniteQuery({ queryKey: ['admin-case-messages', id, chatGrant], initialPageParam: null as string | null, queryFn: ({ pageParam }) => apiEnvelope<{ id: string; body: string; sentAt: string }[]>(`/admin/cases/${id}/messages${pageParam ? '?before=' + pageParam : ''}`), getNextPageParam: (p) => p.meta?.nextCursor ?? undefined, enabled: chatActive, refetchInterval: 10000, retry: false });
  const [decision, setDecision] = useState<'CONTINUE' | 'CANCEL' | 'COMPLETE_AUTHORIZED'>('CONTINUE'); const [reason, setReason] = useState(''); const [selected, setSelected] = useState<string[]>([]); const [review, setReview] = useState(false);
  async function grant(kind: 'chat' | 'evidence') {
    const result = await action.run<{ expiresAt: string }>(`/admin/cases/${id}/${kind}-access`, { reason: accessReason.trim() });
    if (result) { if (kind === 'chat') setChatGrant(result.expiresAt); else setEvidenceGrant(result.expiresAt); }
  }
  if (detail.isPending) return <p role="status">Memuat kasus…</p>;
  if (detail.isError || !detail.data) return <Notice kind="error">Kasus tidak ditemukan atau akun ini tidak berhak membukanya.</Notice>;
  const row = detail.data; const assigned = row.assignedAdminId === me.data?.id;
  return <><Link href="/app/admin/sengketa" className="back-link">← Antrean sengketa</Link><div className="app-heading"><div><span className="eyebrow">ADMIN / KASUS {id.slice(0, 8)}</span><h1>{row.transactionTitle}</h1><p>{row.status === 'RESOLVED' ? 'Kasus selesai' : assigned ? 'Ditugaskan kepada kamu' : row.assignedAdminId ? 'Ditugaskan kepada admin lain' : 'Belum ditugaskan'}</p></div></div><ActionFeedback action={action} />
    {!row.assignedAdminId && row.status !== 'RESOLVED' && <section className="app-panel form-stack"><h2>Ambil penugasan kasus</h2><p>Pengambilan dicatat pada audit. Isi percakapan dan bukti memerlukan alasan akses tersendiri.</p><Button disabled={action.pending} onClick={() => action.run(`/admin/disputes/${id}/claim`, { expectedVersion: row.version })}>Ambil kasus</Button></section>}
    {assigned && <div className="transaction-layout"><div className="transaction-main"><section className="app-panel form-stack"><h2>Konteks transaksi</h2><p className="preserve-lines">{row.reason}</p>{row.transaction && <><p>{transactionLabels[row.transaction.status]} · {row.transaction.confirmations.length}/{row.transaction.requiredConfirmations.length} konfirmasi</p><p>Asal penyelesaian: {row.transaction.resolutionOrigin ?? 'Belum selesai'}</p><Link href={`/app/transaksi/${row.transactionId}`} className="link-button">Lihat snapshot dan konfirmasi →</Link></>}{row.resolution && <Notice>Putusan: {row.resolution} · {row.resolutionReason}</Notice>}</section>
      <section className="app-panel form-stack"><h2>Akses data privat kasus</h2><Field label="Alasan akses bukti atau percakapan" htmlFor="case-access-reason"><textarea id="case-access-reason" className="textarea" minLength={5} maxLength={1000} value={accessReason} onChange={(e) => setAccessReason(e.target.value)} /></Field><div className="form-actions"><Button variant="secondary" disabled={action.pending} onClick={() => grant('evidence')}>Buka bukti dengan audit</Button><Button variant="quiet" disabled={action.pending} onClick={() => grant('chat')}>Buka chat dengan audit</Button></div><p className="meta">Akses berlaku lima menit dan diperiksa ulang oleh server.</p></section>
      {evidenceActive && <section className="app-panel form-stack"><h2>Bukti kasus</h2>{evidence.isPending ? <p role="status">Memuat bukti…</p> : evidence.isError ? <Notice kind="error">Akses bukti berakhir atau tidak tersedia. Minta akses baru dengan alasan.</Notice> : <><EvidenceList evidence={evidence.data ?? []} /><fieldset className="form-stack"><legend>Rujukan bukti untuk putusan</legend>{evidence.data?.map((e) => <label key={e.id} className="transaction-consent"><input type="checkbox" checked={selected.includes(e.id)} onChange={(event) => setSelected((old) => event.target.checked ? [...old, e.id] : old.filter((v) => v !== e.id))} /> Bukti {e.id.slice(0, 8)} · {e.note?.slice(0, 75) ?? 'Foto/pesan terkait'}</label>)}</fieldset></>}</section>}
      {chatActive && <section className="app-panel form-stack"><h2>Percakapan terkait</h2>{messages.isPending ? <p role="status">Memuat chat…</p> : messages.isError ? <Notice kind="error">Akses chat berakhir atau tidak tersedia. Minta akses baru.</Notice> : <>{messages.hasNextPage && <Button variant="quiet" onClick={() => messages.fetchNextPage()}>Muat pesan sebelumnya</Button>}{messages.data?.pages.slice().reverse().flatMap((p) => p.data).map((m) => <blockquote key={m.id}><p>{m.body}</p><small>{new Date(m.sentAt).toLocaleString('id-ID')}</small></blockquote>)}{!messages.data?.pages[0].data.length && <p>Percakapan belum memiliki pesan.</p>}</>}</section>}
    </div><aside className="transaction-side">{row.status !== 'RESOLVED' && <form className="app-panel form-stack" onSubmit={(e) => { e.preventDefault(); setReview(true); }}><h2>Putusan kasus</h2><Field label="Tindakan" htmlFor="case-decision"><Select id="case-decision" className="select" value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}><option value="CONTINUE">Lanjutkan proses konfirmasi</option><option value="CANCEL">Batalkan dan lepaskan reservasi</option><option value="COMPLETE_AUTHORIZED">Selesaikan melalui otorisasi admin</option></Select></Field><Field label="Alasan putusan" htmlFor="case-resolution-reason"><textarea className="textarea" id="case-resolution-reason" minLength={5} maxLength={1000} required value={reason} onChange={(e) => setReason(e.target.value)} /></Field><p>{selected.length} bukti dirujuk. Pilih setidaknya satu bukti setelah membuka akses.</p><Button type="submit" disabled={action.pending}>Tinjau putusan</Button></form>}</aside></div>}
    {review && row.transaction && <ConfirmAction title="Konfirmasi putusan sengketa" buttonLabel="Simpan putusan" pending={action.pending} onClose={() => setReview(false)} onConfirm={async () => { const result = await action.run(`/admin/transactions/${row.transactionId}/resolve-dispute`, { expectedVersion: row.transaction!.version, caseId: id, decision, reason: reason.trim(), evidenceIds: selected }); if (result) setReview(false); }}><p>{decision === 'COMPLETE_AUTHORIZED' ? 'Putusan ini memindahkan kepemilikan dan mencatat transfer dengan asal otorisasi admin.' : decision === 'CANCEL' ? 'Putusan ini melepas reservasi tanpa memindahkan kepemilikan.' : 'Putusan ini membuka kembali proses konfirmasi.'}</p><p>{reason}</p><p>{selected.length} bukti dirujuk.</p><ActionFeedback action={action} onRecovered={() => setReview(false)} /></ConfirmAction>}
  </>;
}
