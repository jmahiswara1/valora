'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';
import type { ExplanationDto } from '@valora/contracts';
import { Button, Notice } from '../../components/ui/primitives';

const fallbackCopy = {
  DISABLED: 'Penjelasan ini menggunakan rubrik Valora.',
  NOT_CONFIGURED: 'Penjelasan AI belum tersedia. Penjelasan dari rubrik tetap dapat dibaca.',
  USER_QUOTA: 'Batas penjelasan AI harianmu sudah tercapai. Penjelasan dari rubrik tetap tersedia.',
  APP_QUOTA: 'Batas penjelasan AI platform hari ini sudah tercapai. Penjelasan dari rubrik tetap tersedia.',
  BUSY: 'Layanan AI sedang sibuk. Gunakan penjelasan dari rubrik atau coba lagi sebentar.',
  TIMEOUT: 'AI belum merespons tepat waktu. Penjelasan dari rubrik tersedia di bawah.',
  UPSTREAM_UNAVAILABLE: 'Layanan AI sedang tidak tersedia. Penjelasan dari rubrik tersedia di bawah.',
  INVALID_OUTPUT: 'Hasil AI tidak dapat digunakan. Penjelasan di bawah mengikuti rubrik Valora.',
};
const actionNames = { REPAIR: 'Repair', RESELL: 'Resell', EXCHANGE: 'Exchange', DONATE: 'Donate' };
const statusNames = { ELIGIBLE: 'Dapat dipilih', NEEDS_DATA: 'Perlu data', INELIGIBLE: 'Belum layak' };

export function AssessmentExplanation({ id }: { id: string }) {
  const result = useQuery({ queryKey: ['explanation', id], enabled: false,
    queryFn: () => api<ExplanationDto>(`/assessments/${id}/explain`, { method: 'POST', timeoutMs: 75000 }),
    retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const [now, setNow] = useState(() => Date.now());
  const error = result.error;
  const denied = error instanceof ApiClientError && ([401, 403, 404].includes(error.status) || ['SESSION_CHANGED', 'STATE_CONFLICT'].includes(error.code));
  const data = denied ? undefined : result.data;
  const retryAt = data?.retryAt ? Date.parse(data.retryAt) : 0;
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  const waiting = retryAt > now;
  const fallback = data?.fallbackReason;
  const canRetry = !fallback || !['DISABLED', 'NOT_CONFIGURED'].includes(fallback);
  const stale = data?.expiresAt && Date.parse(data.expiresAt) <= now;
  const retryDate = retryAt ? new Date(retryAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) : null;
  return <section className="assessment-section explanation-section" aria-labelledby={`explanation-${id}`} aria-busy={result.isFetching}>
    <h3 id={`explanation-${id}`}>Memahami hasil penilaian</h3>
    <p>AI membantu menjelaskan hasil dari rubrik Valora. Hanya kategori, nilai komponen, dan keputusan penilaian yang dikirim ke layanan AI.</p>
    <p className="muted">Penjelasan tidak mengubah Score atau kelayakan tindakan dan tetap berdasarkan laporan pengguna.</p>
    {!data && !denied && <Button variant="secondary" disabled={result.isFetching} onClick={() => void result.refetch()}>{result.isFetching ? 'Membuat penjelasan…' : 'Jelaskan hasil penilaian'}</Button>}
    {result.isFetching && <p role="status">Menyiapkan penjelasan. Proses ini dapat memerlukan waktu hingga satu menit.</p>}
    {error && <Notice kind="error">{error instanceof ApiClientError ? error.message : 'Penjelasan belum dapat dimuat. Coba lagi.'}{data && ' Hasil sebelumnya tetap tersedia.'}</Notice>}
    {denied && error instanceof ApiClientError && error.code === 'STATE_CONFLICT' && <Button variant="secondary" onClick={() => window.location.reload()}>Muat ulang penilaian</Button>}
    {data && <div className="form-stack">
      <div className="explanation-source"><strong>{data.source === 'AI' ? 'Penjelasan AI' : 'Penjelasan dari rubrik'}</strong>{data.cached && <span className="muted">Hasil tersimpan</span>}</div>
      {fallback && <Notice>{fallbackCopy[fallback]}{waiting && <p>{['USER_QUOTA', 'APP_QUOTA'].includes(fallback) ? `Tersedia kembali ${retryDate} WIB.` : 'Tunggu sebentar sebelum mencoba lagi.'}</p>}</Notice>}
      {data.historical && <Notice>Penilaian ini historis. Gunakan penilaian terkini sebelum memulai kesepakatan baru.</Notice>}
      <p>{data.summary}</p>
      <details key={id} className="explanation-details">
        <summary aria-controls={`explanation-details-${id}`}>
          <span className="explanation-label-collapsed">Lihat penjelasan lengkap</span>
          <span className="explanation-label-expanded">Ringkas penjelasan</span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div id={`explanation-details-${id}`} className="form-stack explanation-body">
          {data.strengths.length > 0 && <div><h4>Komponen yang mendukung</h4><ul>{data.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          {data.limitations.length > 0 && <div><h4>Batas penilaian</h4><ul>{data.limitations.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          <div><h4>Alasan setiap pilihan</h4><dl className="explanation-actions">{data.actions.map(action => <div key={action.action}><dt><strong>{actionNames[action.action]}</strong><span className={`badge ${action.status === 'ELIGIBLE' ? 'badge-green' : 'badge-warn'}`}>{statusNames[action.status]}</span></dt><dd><ul>{action.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul></dd></div>)}</dl></div>
          <div><h4>Langkah berikutnya</h4><ul>{data.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        </div>
      </details>
      <small className="muted">Bukan pemeriksaan fisik atau penetapan harga.{data.generatedAt && ` Dibuat ${new Date(data.generatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}.`}</small>
      {(fallback && canRetry || error || stale) && <div><Button variant="secondary" disabled={result.isFetching || waiting} onClick={() => void result.refetch()}>{result.isFetching ? 'Membuat penjelasan…' : waiting ? 'Coba lagi setelah jeda' : stale && data.source === 'AI' ? 'Perbarui penjelasan' : 'Coba penjelasan AI lagi'}</Button></div>}
    </div>}
  </section>;
}
