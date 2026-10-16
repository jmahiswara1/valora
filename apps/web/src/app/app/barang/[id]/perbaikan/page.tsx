'use client';

import { Select } from '@/components/ui/select';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import type { ItemDto, RepairDto } from '@valora/contracts';
import { useMe } from '@/lib/session';
import { ActionFeedback } from '@/components/ui/action-feedback';
import { useCriticalAction } from '@/hooks/use-critical-action';
import { PrivatePhoto } from '@/features/items/photo';
import { Button, Field, Input, Notice } from "@/components/ui/primitives";
import { AccountError } from '@/features/account/error';
import { AccountSkeleton } from '@/features/account/skeleton';
import { api, ApiClientError } from '@/lib/api';

const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
const localDateTime = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const failure = (cause: unknown) => cause instanceof ApiClientError ? cause.message : 'Koneksi gagal. Coba lagi.';

export default function RepairsPage() {
  const { id } = useParams<{ id: string }>();
  const cache = useQueryClient();
  const item = useQuery({ queryKey: ['item', id], queryFn: () => api<ItemDto>(`/items/${id}`) });
  const history = useQuery({ queryKey: ['repairs', id], queryFn: () => api<RepairDto[]>(`/items/${id}/repairs`) });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false); const running = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const me = useMe(); const action = useCriticalAction('repair:' + id, me.data?.id ?? '');

  async function refresh() {
    await Promise.all([cache.invalidateQueries({ queryKey: ['item', id] }), cache.invalidateQueries({ queryKey: ['repairs', id] }), cache.invalidateQueries({ queryKey: ['assessments', id] })]);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (running.current) return; setError(''); setSuccess('');
    const formElement = event.currentTarget;
    if (!item.data) return;
    if (files.length > 4) { setError('Maksimal empat foto bukti per Repair.'); return; }
    const form = new FormData(formElement);
    const cost = String(form.get('costIdr') ?? '').trim();
    running.current = true; setBusy(true);
    try {
      const evidenceTicketIds: string[] = [];
      for (const file of files) {
        const ticket = await api<{ ticketId: string; uploadUrl: string }>(`/items/${id}/media/tickets`, { method: 'POST', body: { fileName: file.name, mime: file.type, bytes: file.size, purpose: 'REPAIR_EVIDENCE' } });
        await api(ticket.uploadUrl.replace('/api/v1', ''), { method: 'PUT', body: file });
        evidenceTicketIds.push(ticket.ticketId);
      }
      await api<RepairDto>(`/items/${id}/repairs`, { method: 'POST', body: {
        activityKind: form.get('activityKind'), expectedItemVersion: item.data.version, performedAt: new Date(String(form.get('performedAt'))).toISOString(),
        actionSummary: String(form.get('actionSummary') ?? '').trim(), privateNotes: String(form.get('privateNotes') ?? '').trim() || null,
        costIdr: cost === '' ? null : Number(cost), costKind: cost === '' ? null : form.get('costKind'),
        outcome: form.get('outcome'), afterCondition: String(form.get('afterCondition') ?? '').trim(),
        shareSummaryPublic: form.get('shareSummaryPublic') === 'on', shareDetailsWithFutureOwner: form.get('shareDetailsWithFutureOwner') === 'on', evidenceTicketIds,
      } });
      formElement.reset(); setFiles([]); await refresh(); setSuccess('Repair tersimpan sebagai laporan pemilik. Jika kondisi berubah, buat penilaian baru.');
    } catch (cause) { setError(failure(cause)); }
    finally { running.current = false; setBusy(false); }
  }
  async function correct(event: FormEvent<HTMLFormElement>, record: RepairDto) {
    event.preventDefault(); if (running.current) return; setError(''); setSuccess(''); running.current = true; setBusy(true);
    const form = new FormData(event.currentTarget);
    const cost = String(form.get('costIdr') ?? '').trim();
    try {
      const result = await action.run<RepairDto>(`/repairs/${record.id}/corrections`, {
        expectedVersion: record.version, reason: String(form.get('reason') ?? '').trim(), performedAt: new Date(String(form.get('performedAt'))).toISOString(),
        actionSummary: String(form.get('actionSummary') ?? '').trim(), privateNotes: String(form.get('privateNotes') ?? '').trim() || null,
        costIdr: cost === '' ? null : Number(cost), costKind: cost === '' ? null : form.get('costKind'),
        outcome: form.get('outcome'), afterCondition: String(form.get('afterCondition') ?? '').trim(),
        shareSummaryPublic: form.get('shareSummaryPublic') === 'on', shareDetailsWithFutureOwner: form.get('shareDetailsWithFutureOwner') === 'on',
      });
      if (!result) return; setEditing(null); await refresh(); setSuccess('Koreksi tersimpan dengan alasan dan jejak revisi.');
    } catch (cause) { setError(failure(cause)); }
    finally { running.current = false; setBusy(false); }
  }
  async function voidRecord(event: FormEvent<HTMLFormElement>, record: RepairDto) {
    event.preventDefault(); if (running.current) return; setError(''); setSuccess(''); running.current = true; setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await action.run<RepairDto>(`/repairs/${record.id}/void`, { expectedVersion: record.version, reason: String(form.get('reason') ?? '').trim() });
      if (!result) return; setVoiding(null); await refresh(); setSuccess('Catatan Repair dibatalkan. Periksa kondisi Item dan buat penilaian baru bila perlu.');
    } catch (cause) { setError(failure(cause)); }
    finally { running.current = false; setBusy(false); }
  }

  if (item.isPending || history.isPending) return <AccountSkeleton />;
  if (item.isError || history.isError) return <AccountError retry={() => { void item.refetch(); void history.refetch(); }}>Riwayat perawatan gagal dimuat. <Link href={`/app/barang/${id}`}>Kembali ke barang</Link></AccountError>;
  return <><div className="app-heading"><div><Link className="eyebrow" href={`/app/barang/${id}`}>← {item.data.title}</Link><h1>Perawatan & perbaikan</h1><p>Catat tindakan yang kamu lakukan. Perawatan dan perbaikan tetap dibedakan pada riwayat barang.</p></div><Link className="button button-secondary" href={`/app/barang/${id}/penilaian`}>Lihat penilaian</Link></div>
    <ActionFeedback action={action} onRecovered={() => { setEditing(null); setVoiding(null); }} />{error && <Notice kind="error">{error}</Notice>}{success && <Notice kind="success">{success}</Notice>}
    <div className="repair-layout"><section className="repair-form-panel"><h2>Catat tindakan manual</h2><Link href={`/app/barang/${id}/panduan`}>Butuh langkah terarah? Lihat panduan →</Link><p className="muted">Semua data adalah laporan pemilik. Biaya dan bukti tetap privat kecuali kamu memilih berbagi rincian kepada owner berikutnya.</p><form className="form-stack" onSubmit={submit} aria-busy={busy}><fieldset className="account-form-fields form-stack" disabled={busy}>
      <Field label="Jenis aktivitas" htmlFor="activityKind"><Select className="select" id="activityKind" name="activityKind" defaultValue="REPAIR"><option value="REPAIR">Perbaikan</option><option value="MAINTENANCE">Perawatan</option></Select></Field><Field label="Tanggal tindakan" htmlFor="performedAt"><Input id="performedAt" name="performedAt" type="datetime-local" required defaultValue={localDateTime()} /></Field>
      <Field label="Tindakan yang dilakukan" htmlFor="actionSummary"><textarea className="textarea" id="actionSummary" name="actionSummary" minLength={5} maxLength={1500} required placeholder="Contoh: mengencangkan sekrup pegangan laci" /></Field>
      <div className="form-grid"><Field label="Hasil" htmlFor="outcome"><Select className="select" id="outcome" name="outcome"><option value="SUCCEEDED">Berhasil</option><option value="UNSUCCESSFUL">Belum berhasil</option></Select></Field><Field label="Biaya (Rp), opsional" htmlFor="costIdr"><Input id="costIdr" name="costIdr" type="number" min={0} step={1} placeholder="Kosong bila tidak dicatat" /></Field></div>
      <Field label="Jenis biaya" htmlFor="costKind"><Select className="select" id="costKind" name="costKind"><option value="ACTUAL">Biaya aktual</option><option value="ESTIMATE">Perkiraan biaya</option></Select></Field>
      <Field label="Kondisi sesudah Repair" htmlFor="afterCondition"><textarea className="textarea" id="afterCondition" name="afterCondition" minLength={3} maxLength={1500} required defaultValue={item.data.conditionSummary ?? ''} placeholder="Jelaskan kondisi barang sekarang" /></Field>
      <Field label="Catatan privat, opsional" htmlFor="privateNotes"><textarea className="textarea" id="privateNotes" name="privateNotes" maxLength={3000} /></Field>
      <Field label="Foto bukti, maksimal empat" htmlFor="repairEvidence"><Input id="repairEvidence" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></Field>{files.length > 0 && <small>{files.map((file) => file.name).join(', ')}</small>}
      <label className="check-row"><input type="checkbox" name="shareSummaryPublic" /> Izinkan ringkasan tindakan tampil pada riwayat publik nanti</label>
      <label className="check-row"><input type="checkbox" name="shareDetailsWithFutureOwner" /> Bagikan catatan rinci dan foto bukti kepada owner berikutnya; biaya tetap privat</label>
      </fieldset><Button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan catatan'}</Button>
    </form></section>
    <section className="repair-history"><h2>Catatan terdahulu</h2>{history.data.length === 0 ? <div className="empty-state"><h3>Belum ada Repair</h3><p>Tindakan yang kamu catat akan muncul di sini bersama waktu dan kondisinya.</p></div> : <div className="history-list">{history.data.map((record) => <article className="repair-entry" key={record.id}><div className="repair-entry-heading"><div><span className="eyebrow">{new Date(record.performedAt).toLocaleDateString('id-ID')}</span><span className="badge">{record.activityKind === 'MAINTENANCE' ? 'Perawatan' : 'Perbaikan'}</span><h3>{record.actionSummary}</h3>{record.tutorialSessionId && <Link href={'/app/panduan/' + record.tutorialSessionId}>Lihat sesi panduan</Link>}</div><span className={`badge ${record.status === 'VALID' ? 'badge-green' : 'badge-warn'}`}>{record.status === 'VALID' ? 'TERCATAT' : 'DIBATALKAN'}</span></div><p>{record.outcome === 'SUCCEEDED' ? 'Dilaporkan berhasil' : 'Dilaporkan belum berhasil'} · kondisi sesudah: {record.afterCondition}</p>{record.costIdr != null && <small>{record.costKind === 'ACTUAL' ? 'Biaya aktual' : 'Perkiraan biaya'}: {rupiah(record.costIdr)} · privat</small>}{record.privateNotes && <p className="repair-private-note">Catatan privat: {record.privateNotes}</p>}{record.evidence.length > 0 && <div className="repair-evidence">{record.evidence.map((media, index) => <PrivatePhoto key={media.id} mediaId={media.id} alt={`Foto bukti Repair ${index + 1}`} />)}</div>}{record.status === 'VOID' && record.voidReason && <Notice kind="error">Alasan pembatalan: {record.voidReason}</Notice>}
          {record.status === 'VALID' && <div className="form-actions"><Button type="button" variant="quiet" size="small" onClick={() => { setEditing(editing === record.id ? null : record.id); setVoiding(null); }}>Koreksi</Button><Button type="button" variant="quiet" size="small" onClick={() => { setVoiding(voiding === record.id ? null : record.id); setEditing(null); }}>Batalkan catatan</Button></div>}
          {editing === record.id && <form className="form-stack repair-edit" onSubmit={(event) => correct(event, record)}><Field label="Alasan koreksi" htmlFor={`reason-${record.id}`}><Input id={`reason-${record.id}`} name="reason" required minLength={5} maxLength={500} /></Field><Field label="Tanggal tindakan" htmlFor={`date-${record.id}`}><Input id={`date-${record.id}`} name="performedAt" type="datetime-local" required defaultValue={new Date(new Date(record.performedAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} /></Field><Field label="Tindakan" htmlFor={`action-${record.id}`}><textarea className="textarea" id={`action-${record.id}`} name="actionSummary" required minLength={5} defaultValue={record.actionSummary} /></Field><div className="form-grid"><Field label="Hasil" htmlFor={`outcome-${record.id}`}><Select className="select" id={`outcome-${record.id}`} name="outcome" defaultValue={record.outcome}><option value="SUCCEEDED">Berhasil</option><option value="UNSUCCESSFUL">Belum berhasil</option></Select></Field><Field label="Biaya (Rp)" htmlFor={`cost-${record.id}`}><Input id={`cost-${record.id}`} name="costIdr" type="number" min={0} step={1} defaultValue={record.costIdr ?? ''} /></Field></div><Field label="Jenis biaya" htmlFor={`kind-${record.id}`}><Select className="select" id={`kind-${record.id}`} name="costKind" defaultValue={record.costKind ?? 'ACTUAL'}><option value="ACTUAL">Aktual</option><option value="ESTIMATE">Perkiraan</option></Select></Field><Field label="Kondisi sesudah" htmlFor={`condition-${record.id}`}><textarea className="textarea" id={`condition-${record.id}`} name="afterCondition" required minLength={3} defaultValue={record.afterCondition} /></Field><Field label="Catatan privat" htmlFor={`notes-${record.id}`}><textarea className="textarea" id={`notes-${record.id}`} name="privateNotes" defaultValue={record.privateNotes ?? ''} /></Field><label className="check-row"><input type="checkbox" name="shareSummaryPublic" defaultChecked={record.shareSummaryPublic} /> Bagikan ringkasan publik</label><label className="check-row"><input type="checkbox" name="shareDetailsWithFutureOwner" defaultChecked={record.shareDetailsWithFutureOwner} /> Bagikan rincian kepada owner berikutnya</label><Button disabled={busy}>Simpan koreksi</Button></form>}
          {voiding === record.id && <form className="form-stack repair-edit" onSubmit={(event) => voidRecord(event, record)}><Notice kind="error">Catatan akan diberi status dibatalkan. Kondisi Item tidak otomatis dikembalikan.</Notice><Field label="Alasan pembatalan" htmlFor={`void-${record.id}`}><Input id={`void-${record.id}`} name="reason" required minLength={5} maxLength={500} /></Field><Button variant="danger" disabled={busy}>Batalkan catatan ini</Button></form>}
        </article>)}</div>}</section></div>
  </>;
}
