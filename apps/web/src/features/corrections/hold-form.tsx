'use client';

import { useState } from 'react';
import { ReasonField } from '../../components/ui/reason-field';
import { Field, Input } from "../../components/ui/primitives";
import { CriticalButton } from '../../components/ui/critical-button';

export function HoldForm({ scopeType, scopeId }: { scopeType: 'REPORT' | 'CORRECTION' | 'DISPUTE'; scopeId: string }) {
  const [reason, setReason] = useState(''); const [reviewAt, setReviewAt] = useState('');
  return <details className="operations-detail"><summary>Tahan retensi data kasus</summary><div className="form-stack"><p>Penahanan berlaku sampai jadwal review. Data yang sudah dihapus tidak dapat dipulihkan.</p><ReasonField id={'hold-reason-' + scopeId} value={reason} onChange={setReason} /><Field label="Review berikutnya (Asia/Jakarta)" htmlFor={'hold-date-' + scopeId}><Input id={'hold-date-' + scopeId} type="datetime-local" value={reviewAt} onChange={(e) => setReviewAt(e.target.value)} required /></Field><CriticalButton path="/admin/retention/holds" body={{ scopeType, scopeId, reason, reviewAt: reviewAt ? new Date(reviewAt + '+07:00').toISOString() : '' }} title="Tahan retensi" description="Simpan alasan dan jadwal review penahanan data kasus." disabled={reason.trim().length < 5 || !reviewAt}>Simpan penahanan</CriticalButton></div></details>;
}
