'use client';

import { Select } from '@/components/ui/select';

import { useRouter } from 'next/navigation';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useMe } from '@/lib/session';
import { useCriticalAction } from '../../../hooks/use-critical-action';
import { api } from '@/lib/api';
import type { ModerationDetailDto } from '@valora/contracts';
import { useState } from 'react';
import { Notice, Field, Input, Button } from "../../../components/ui/primitives";
import Link from 'next/link';
import { PrivatePhoto } from '../../items/photo';
import { ActionFeedback } from '../../../components/ui/action-feedback';
import { money } from '../../market/process-shared';

export function ModerationReviewPage({ revisionId }: { revisionId: string }) {
  const router = useRouter(); const cache = useQueryClient(); const me = useMe(); const action = useCriticalAction('moderation:' + revisionId, me.data?.id ?? '');
  const detail = useQuery({ queryKey: ['admin', 'listing-review', revisionId], queryFn: () => api<ModerationDetailDto>(`/admin/listing-reviews/${revisionId}`), retry: false });
  const [decision, setDecision] = useState<'APPROVE' | 'REQUEST_CHANGES' | 'REJECT'>('REQUEST_CHANGES'); const [reasonCode, setReasonCode] = useState('COPY_CORRECTION'); const [reason, setReason] = useState(''); const [riskText, setRiskText] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  async function decide(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!detail.data) return; setSaving(true); setError('');
    try { const result = await action.run(`/admin/listing-reviews/${revisionId}/decide`, { expectedVersion: detail.data.listingVersion, decision, reasonCode, reasonText: reason, riskFlags: riskText.split(',').map((value) => value.trim()).filter(Boolean) }); if (!result) return; await cache.invalidateQueries({ queryKey: ['admin', 'listing-reviews'] }); router.push('/app/admin/moderasi'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Keputusan belum disimpan.'); }
    finally { setSaving(false); }
  }
  if (detail.isPending) return <div className="loading-line" />;
  if (detail.isError || !detail.data) return <Notice kind="error">Pengajuan tidak ditemukan atau sudah diproses.</Notice>;
  const row = detail.data; const rev = row.revision;
  return <><div className="app-heading"><div><span className="eyebrow">ADMIN / REVIEW {row.specialReview ? 'KHUSUS' : 'AWAL'}</span><h1>{rev.title}</h1><p>{row.ownerName} · {row.cityName} · {row.listingType}</p></div><Link href="/app/admin/moderasi" className="button button-secondary">Antrean review</Link></div>
    <div className="moderation-layout"><section className="app-panel"><div className="moderation-photo-grid">{rev.media.map((media) => <PrivatePhoto key={media.id} mediaId={media.id} alt={`Foto pengajuan ${rev.title}`} className="moderation-photo" />)}</div><h2>{rev.title}</h2><p>{rev.description}</p><div className="detail-list"><div><dt>Kondisi</dt><dd>{rev.condition} · Score {rev.score ?? 'belum tersedia'}</dd></div><div><dt>Pengungkapan</dt><dd>{rev.conditionDisclosure}</dd></div><div><dt>Harga</dt><dd>{rev.askingPriceIdr === null ? 'Tidak ada nominal' : money(rev.askingPriceIdr)}</dd></div><div><dt>Kota dan metode serah terima</dt><dd>{rev.city.name} · {rev.handoverMethods.join(', ')}</dd></div><div><dt>Versi penilaian</dt><dd>{rev.ruleVersion} · Assessment {rev.assessmentId}</dd></div></div>{row.riskFlags.length > 0 && <div className="review-risk-flags"><strong>Penanda pemeriksaan</strong>{row.riskFlags.map((flag) => <span className="badge badge-warn" key={flag}>{flag}</span>)}</div>}</section>
    <form className="app-panel form-stack" onSubmit={decide}><span className="eyebrow">KEPUTUSAN · REVISI {rev.revisionNo}</span><h2>Catat hasil review.</h2><Field label="Keputusan" htmlFor="review-decision"><Select className="select" id="review-decision" value={decision} onChange={(e) => { setDecision(e.target.value as typeof decision); }}><option value="APPROVE">Setujui dan tayangkan</option><option value="REQUEST_CHANGES">Minta perubahan</option><option value="REJECT">Tolak pengajuan</option></Select></Field><Field label="Kode alasan" htmlFor="review-code"><Input id="review-code" required minLength={2} maxLength={60} value={reasonCode} onChange={(e) => { setReasonCode(e.target.value); }} /></Field><Field label="Alasan untuk pemilik" htmlFor="review-reason"><textarea id="review-reason" className="textarea" required minLength={5} maxLength={1000} value={reason} onChange={(e) => { setReason(e.target.value); }} placeholder="Jelaskan fakta yang ditinjau dan perubahan yang diperlukan." /></Field><Field label="Penanda risiko (opsional, pisahkan dengan koma)" htmlFor="review-risks"><Input id="review-risks" value={riskText} onChange={(e) => { setRiskText(e.target.value); }} /></Field>{error && <Notice kind="error">{error}</Notice>}<ActionFeedback action={action} onRecovered={() => router.push('/app/admin/moderasi')} /><Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan keputusan'}</Button></form></div></>;
}
