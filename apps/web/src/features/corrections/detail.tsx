'use client';

import { Select } from '@/components/ui/select';

import type { CorrectionMeta } from './types';
import { useMe } from '@/lib/session';
import { useCriticalAction } from '../../hooks/use-critical-action';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Field, Input, Notice, Button } from "../../components/ui/primitives";
import { ActionFeedback } from '../../components/ui/action-feedback';
import { ReasonField } from '../../components/ui/reason-field';
import { CriticalButton } from '../../components/ui/critical-button';
import { useExpiringAccess } from '@/lib/access';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Heading } from '../../components/ui/heading';
import { LoadState } from '../../components/ui/query-state';
import { dateTime } from '../../lib/date';
import Image from 'next/image';
import { PassportVisibilityForm } from '../passport/visibility-form';
import { HoldForm } from './hold-form';

type CaseDetail = CorrectionMeta & { reason: string; resolutionReason: string | null; transaction: { id: string; version: number; type: string; correctedAt: string | null; finalPriceIdr: string | null; items: { id: string; title: string; estimatedWeightGrams: number | null; assessmentId: string }[] }; evidence: { id: string; note: string; messageSnapshot: { body: string; sentAt: string } | null; createdAt: string; purgedAt: string | null; media: { id: string; url: string }[] }[]; sources: { assessments: { id: string; itemId: string; version: number; status: string; valid: boolean }[]; repairs: { id: string; itemId: string; version: number; status: string }[] }; passports: { id: string; passportVersion: number; passportVisibility: string }[] };

function CorrectionEvidenceForm({ data }: { data: CaseDetail }) {
  const me = useMe(); const action = useCriticalAction('correction-evidence:' + data.id, me.data?.id ?? '');
  const [note, setNote] = useState(''); const [messageId, setMessageId] = useState(''); const [files, setFiles] = useState<File[]>([]); const [tickets, setTickets] = useState<string[] | null>(null); const [uploading, setUploading] = useState(false); const [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setUploading(true);
    try {
      if (files.length > 4) throw new Error('Maksimal empat foto.');
      const ids = tickets ?? [];
      if (!tickets) { for (const file of files) { if (file.size > 8 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Gunakan JPEG, PNG, atau WebP maksimal 8 MiB.'); const ticket = await api<{ ticketId: string }>(`/correction-cases/${data.id}/media/tickets`, { method: 'POST', body: { fileName: file.name, mime: file.type, bytes: file.size, purpose: 'CASE_EVIDENCE' } }); await api(`/media/uploads/${ticket.ticketId}`, { method: 'PUT', body: file }); ids.push(ticket.ticketId); } setTickets(ids); }
      const result = await action.run(`/correction-cases/${data.id}/evidence`, { expectedVersion: data.version, note, ...(messageId ? { messageId } : {}), ticketIds: ids });
      if (result) { setNote(''); setMessageId(''); setFiles([]); setTickets(null); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Bukti belum tersimpan.'); } finally { setUploading(false); }
  }
  return <form className="form-stack" onSubmit={submit}><h2>Tambahkan bukti privat</h2><Field label="Catatan bukti" htmlFor="correction-note"><textarea id="correction-note" className="textarea" required minLength={5} maxLength={3000} value={note} onChange={(e) => setNote(e.target.value)} disabled={uploading || action.pending || action.hasSaved()} /></Field><Field label="ID pesan terkait (opsional)" htmlFor="correction-message"><Input id="correction-message" value={messageId} onChange={(e) => setMessageId(e.target.value)} disabled={uploading || action.pending || action.hasSaved()} /></Field><Field label="Foto bukti" htmlFor="correction-files" hint="Maksimal empat foto; JPEG, PNG, WebP, 8 MiB per foto."><input id="correction-files" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={uploading || action.pending || action.hasSaved()} onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setTickets(null); }} /></Field>{error && <Notice kind="error">{error}</Notice>}<Button type="submit" disabled={uploading || action.pending}>{uploading || action.pending ? 'Menyimpan…' : 'Simpan bukti'}</Button><ActionFeedback action={action} onRecovered={() => { setNote(''); setMessageId(''); setFiles([]); setTickets(null); }} /></form>;
}

function ImpactCorrectionForm({ data }: { data: CaseDetail }) {
  const [metric, setMetric] = useState('ESTIMATED_TRANSFER_WEIGHT'); const [itemId, setItemId] = useState(data.transaction.items[0].id); const [value, setValue] = useState(''); const [reason, setReason] = useState('');
  return <details className="operations-detail"><summary>Koreksi estimasi berat atau nilai Resell</summary><div className="form-stack"><Field label="Metrik" htmlFor="correction-metric"><Select id="correction-metric" className="select" value={metric} onChange={(e) => setMetric(e.target.value)}><option value="ESTIMATED_TRANSFER_WEIGHT">Estimasi berat (gram)</option>{data.transaction.type === 'RESELL' && <option value="CONFIRMED_SALE_VALUE">Nilai Resell (rupiah)</option>}</Select></Field>{metric === 'ESTIMATED_TRANSFER_WEIGHT' && <Field label="Barang yang dikoreksi" htmlFor="correction-weight-item"><Select id="correction-weight-item" className="select" value={itemId} onChange={(e) => setItemId(e.target.value)}>{data.transaction.items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</Select></Field>}<Field label="Nilai total yang benar" htmlFor="impact-correct-value"><Input id="impact-correct-value" inputMode="numeric" pattern="[0-9]+" value={value} onChange={(e) => setValue(e.target.value)} required /></Field><ReasonField id="impact-correct-reason" value={reason} onChange={setReason} /><CriticalButton path="/admin/impact/corrections" body={{ caseId: data.id, expectedVersion: data.transaction.version, metric, ...(metric === 'ESTIMATED_TRANSFER_WEIGHT' ? { itemId } : {}), value, reason }} title="Koreksi kontribusi Impact" description="Selisih dicatat pada periode kejadian dan atribusi sumber asli." disabled={reason.trim().length < 5 || !/^\d+$/.test(value)}>Simpan koreksi Impact</CriticalButton></div></details>;
}

function SourceCorrectionForm({ data }: { data: CaseDetail }) {
  const [source, setSource] = useState(''); const [reason, setReason] = useState('');
  const sources = [...data.sources.assessments.map((a) => ({ ...a, kind: 'assessments', valid: a.valid })), ...data.sources.repairs.map((r) => ({ ...r, kind: 'repairs', valid: r.status === 'VALID' }))]; const selected = sources.find((s) => s.id === source);
  return <details className="operations-detail"><summary>Batalkan atau pulihkan sumber kontribusi</summary><div className="form-stack"><Field label="Penilaian atau Repair terkait" htmlFor="source-correction"><Select id="source-correction" className="select" value={source} onChange={(e) => setSource(e.target.value)}><option value="">Pilih sumber</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.kind} · {s.id.slice(0, 8)} · {s.valid ? 'valid' : 'dibatalkan'}</option>)}</Select></Field><ReasonField id="source-reason" value={reason} onChange={setReason} />{selected && <CriticalButton path={`/admin/${selected.kind}/${selected.id}/validity`} body={{ caseId: data.id, expectedVersion: selected.version, reason, valid: !selected.valid }} title="Koreksi validitas sumber" description="Kredit Impact disesuaikan dengan sumber yang masih valid. Listing yang terpengaruh dijeda." disabled={reason.trim().length < 5}>{selected.valid ? 'Batalkan sumber' : 'Pulihkan sumber'}</CriticalButton>}</div></details>;
}

export function CorrectionCasePage({ id, admin = true }: { id: string; admin?: boolean }) {
  const me = useMe(); const [reason, setReason] = useState(''); const [expiresAt, setExpiresAt] = useState<string | null>(null); const activeAccess = useExpiringAccess(expiresAt, 'correction-detail', id); const access = !admin || activeAccess;
  const cases = useQuery({ queryKey: ['correction-meta', id], enabled: admin, queryFn: () => api<CorrectionMeta>(`/admin/correction-cases/${id}/metadata`) }); const meta = cases.data;
  const detail = useQuery({ queryKey: ['correction-detail', id, access], enabled: access, queryFn: () => api<CaseDetail>(`/correction-cases/${id}`), retry: false }); const data = detail.data;
  const own = meta?.assignedAdminId === me.data?.id;
  return <><Link className="back-link" href={admin ? '/app/admin/transaksi' : '/app/transaksi'}>← Transaksi</Link><Heading eyebrow="KASUS / KOREKSI" title={'Kasus ' + id.slice(0, 8)}>Tinjau fakta dari transaksi yang sudah selesai.</Heading>{admin && !access && <><LoadState query={cases} />{meta && <section className="app-panel form-stack"><p>{meta.status} · transaksi {meta.transactionId.slice(0, 8)}</p><ReasonField value={reason} onChange={setReason} />{!own ? meta.assignedAdminId ? <Notice>Kasus ditugaskan kepada admin lain.</Notice> : <CriticalButton path={`/admin/correction-cases/${id}/claim`} body={{ expectedVersion: meta.version, reason }} title="Ambil kasus koreksi" description="Tetapkan kasus koreksi ini sebagai tugasmu." disabled={reason.trim().length < 5}>Ambil penugasan</CriticalButton> : <CriticalButton path={`/admin/correction-cases/${id}/access`} body={{ reason }} title="Buka bukti koreksi" description="Akses privat dicatat dan berlaku lima menit." disabled={reason.trim().length < 5} onDone={(value) => setExpiresAt((value as { expiresAt: string }).expiresAt)}>Buka bukti privat</CriticalButton>}</section>}</>}
    {access && <><LoadState query={detail} skeleton={!admin} />{admin && detail.isError && <Button variant="secondary" onClick={() => setExpiresAt(null)}>Perbarui akses kasus</Button>}{data && <div className="form-stack"><section className="app-panel form-stack"><span className="badge">{data.status}</span><h2>Konteks dan bukti</h2><p>{data.reason}</p>{data.resolution && <Notice>Hasil: {data.resolution} · {data.resolutionReason}</Notice>}{data.evidence.map((e) => <article className="evidence-entry" key={e.id}><small>{dateTime(e.createdAt)}</small><p>{e.note}</p>{e.messageSnapshot && <blockquote>{e.messageSnapshot.body}</blockquote>}<div className="evidence-photos">{e.media.map((m) => <Image unoptimized key={m.id} src={m.url} width={240} height={180} alt="Foto bukti koreksi privat" />)}</div></article>)}</section>
      {['OPEN', 'IN_REVIEW'].includes(data.status) && <section className="app-panel"><CorrectionEvidenceForm data={data} /></section>}
      {admin && <section className="app-panel form-stack"><h2>Tindakan admin kasus</h2>{['OPEN', 'IN_REVIEW'].includes(data.status) && <><ReasonField id="decision-reason" value={reason} onChange={setReason} /><CriticalButton path={`/admin/transactions/${data.transaction.id}/correct`} body={{ expectedVersion: data.transaction.version, caseId: id, expectedCaseVersion: data.version, reason }} title="Balikkan kepemilikan tercatat" description={`Kembalikan kepemilikan ${data.transaction.items.map((i) => i.title).join(' dan ')} kepada pengirim awal dan balikkan kontribusi transfer. Server memeriksa transfer lanjutan dan reservasi baru.`} disabled={reason.trim().length < 5 || Boolean(data.transaction.correctedAt)} danger>Balikkan kepemilikan</CriticalButton><ImpactCorrectionForm data={data} /><SourceCorrectionForm data={data} /><CriticalButton path={`/admin/correction-cases/${id}/close`} body={{ expectedVersion: data.version, reason }} title="Tutup peninjauan" description="Tutup kasus setelah koreksi selesai atau tidak diperlukan." disabled={reason.trim().length < 5}>Tutup peninjauan</CriticalButton></>}{data.passports.map((p) => <PassportVisibilityForm key={p.id} scopeType="CORRECTION" scopeId={id} itemId={p.id} version={p.passportVersion} current={p.passportVisibility} />)}<HoldForm scopeType="CORRECTION" scopeId={id} /></section>}
    </div>}</>}
  </>;
}
