'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Field, Notice, Button } from "../../components/ui/primitives";

export function TransactionReport({ transactionId }: { transactionId: string }) {
  const [details, setDetails] = useState(''); const [error, setError] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false);
  return <form className="form-stack" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try { await api('/reports', { method: 'POST', body: { targetType: 'TRANSACTION', targetId: transactionId, reasonCode: 'TRANSACTION_HISTORY', details } }); setSent(true); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Laporan gagal dikirim.'); } finally { setBusy(false); } }}><Field label="Isi laporan transaksi" htmlFor={'transaction-report-' + transactionId}><textarea id={'transaction-report-' + transactionId} className="textarea" required minLength={5} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>{error && <Notice kind="error">{error}</Notice>}{sent ? <Notice>Laporan terkirim.</Notice> : <Button type="submit" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim laporan transaksi'}</Button>}</form>;
}
