'use client';

import { Select } from '@/components/ui/select';

import { useState } from 'react';
import { Field } from "../../components/ui/primitives";
import { ReasonField } from '../../components/ui/reason-field';
import { CriticalButton } from '../../components/ui/critical-button';

export function PassportVisibilityForm({ scopeType, scopeId, itemId, version, current }: { scopeType: 'REPORT' | 'CORRECTION'; scopeId: string; itemId: string; version: number; current: string }) {
  const [visibility, setVisibility] = useState(current); const [reason, setReason] = useState('');
  return <details className="operations-detail"><summary>Visibilitas Passport · {current}</summary><div className="form-stack"><Field label="Visibilitas publik" htmlFor={'visibility-' + itemId}><Select className="select" id={'visibility-' + itemId} value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="PUBLIC">Publik sesuai kelayakan</option><option value="LIMITED">Halaman status saja</option><option value="HIDDEN">Sembunyikan dari publik</option></Select></Field><ReasonField id={'visibility-reason-' + itemId} value={reason} onChange={setReason} /><CriticalButton path={`/admin/passport/${itemId}/visibility`} body={{ scopeType, caseId: scopeId, expectedVersion: version, reason, visibility }} title="Ubah visibilitas Passport" description={`Passport ${itemId.slice(0, 8)} akan memakai visibilitas ${visibility}. Riwayat internal tetap tersimpan.`} disabled={reason.trim().length < 5}>Simpan visibilitas</CriticalButton></div></details>;
}
