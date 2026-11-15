'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Flag, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Field, Notice, Button } from "../../components/ui/primitives";
import { Select } from '@/components/ui/select';

export function TransactionReport({ transactionId, onClose, onBusyChange }: { transactionId: string; onClose?: () => void; onBusyChange?: (busy: boolean) => void }) {
  const prefix = useId(); const running = useRef(false);
  const [reasonCode, setReasonCode] = useState('NO_RESPONSE');
  const [details, setDetails] = useState(''); const [error, setError] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false);
  return <form className="form-stack transaction-report-form" aria-busy={busy} onSubmit={async (e) => {
    e.preventDefault(); if (running.current || sent) return;
    running.current = true; setBusy(true); onBusyChange?.(true); setError('');
    try { await api('/reports', { method: 'POST', body: { targetType: 'TRANSACTION', targetId: transactionId, reasonCode, details: details.trim() } }); setSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Laporan gagal dikirim. Coba lagi.'); }
    finally { running.current = false; setBusy(false); onBusyChange?.(false); }
  }}>
    {sent ? <Notice kind="success">Laporan terkirim untuk ditinjau admin. Status transaksi tetap mengikuti proses yang berjalan.</Notice> : <>
      <Field label="Masalah yang terjadi" htmlFor={prefix + '-reason'}><Select id={prefix + '-reason'} className="select" value={reasonCode} disabled={busy} onChange={e => setReasonCode(e.target.value)}>
        <option value="NO_RESPONSE">Pihak lain tidak merespons</option><option value="HANDOVER_ISSUE">Tidak datang atau tidak mengirim barang</option><option value="ITEM_MISMATCH">Barang tidak sesuai kesepakatan</option><option value="MISCONDUCT">Perilaku tidak pantas</option><option value="OTHER">Masalah lainnya</option>
      </Select></Field>
      <Field label="Isi laporan transaksi" htmlFor={prefix + '-details'} hint="Jelaskan kejadian yang perlu ditinjau admin."><textarea id={prefix + '-details'} className="textarea" required minLength={5} maxLength={1000} value={details} disabled={busy} onChange={e => setDetails(e.target.value)} /></Field>
    </>}
    {error && <Notice kind="error">{error}</Notice>}
    <div className="form-actions">{onClose && <Button type="button" variant="quiet" disabled={busy} onClick={onClose}>{sent ? 'Tutup' : 'Kembali'}</Button>}{!sent && <Button type="submit" disabled={busy || details.trim().length < 5}>{busy ? 'Mengirim…' : 'Kirim laporan transaksi'}</Button>}</div>
  </form>;
}

function ReportDialog({ transactionId, canDispute, onClose }: { transactionId: string; canDispute: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null); const titleId = useId(); const [busy, setBusy] = useState(false);
  useEffect(() => {
    const element = ref.current, trigger = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = 'hidden'; heading.current?.focus({ preventScroll: true });
    return () => { element?.close(); document.body.style.overflow = overflow; trigger?.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className="transaction-dialog transaction-report-dialog" aria-labelledby={titleId} aria-describedby={titleId + '-description'} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="transaction-report-heading"><h2 id={titleId} ref={heading} tabIndex={-1}>Laporkan transaksi</h2><button type="button" className="handover-dialog-close" aria-label="Tutup laporan" disabled={busy} onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
    <p id={titleId + '-description'}>Laporan dikirim ke admin untuk ditinjau dan tidak menahan penyelesaian transaksi.{canDispute && ' Jika masalah perlu menahan penyelesaian, gunakan Buka sengketa.'}</p>
    <TransactionReport transactionId={transactionId} onClose={onClose} onBusyChange={setBusy} />
  </dialog>;
}

export function TransactionReportButton({ transactionId, canDispute = false }: { transactionId: string; canDispute?: boolean }) {
  const [open, setOpen] = useState(false);
  return <><Button variant="quiet" onClick={() => setOpen(true)}><Flag size={16} aria-hidden="true" /> Laporkan transaksi</Button>{open && <ReportDialog transactionId={transactionId} canDispute={canDispute} onClose={() => setOpen(false)} />}</>;
}
