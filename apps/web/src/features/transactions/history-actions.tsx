'use client';

import { useState } from 'react';
import { ReasonField } from '../../components/ui/reason-field';
import { CriticalButton } from '../../components/ui/critical-button';
import Link from 'next/link';
import { TransactionReport } from './report-form';

export function TransactionHistoryActions({ transactionId, version }: { transactionId: string; version: number }) {
  const [reason, setReason] = useState(''); const [caseId, setCaseId] = useState('');
  return <details className="operations-detail"><summary>Laporkan masalah pada riwayat selesai</summary><div className="form-stack"><ReasonField id={'history-reason-' + transactionId} value={reason} onChange={setReason} /><CriticalButton path={`/transactions/${transactionId}/corrections`} body={{ expectedVersion: version, reason }} title="Ajukan koreksi riwayat" description="Buka kasus agar admin meninjau kesalahan pencatatan pada transaksi selesai." disabled={reason.trim().length < 5} onDone={(result) => { if (result && typeof result === 'object' && 'id' in result) setCaseId(String(result.id)); }}>Ajukan koreksi riwayat</CriticalButton>{caseId && <Link href={`/app/koreksi/${caseId}`}>Lihat kasus dan tambah bukti →</Link>}<TransactionReport transactionId={transactionId} /></div></details>;
}
