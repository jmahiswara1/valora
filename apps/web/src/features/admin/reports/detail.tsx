'use client';

import { useMe } from '@/lib/session';
import { useState } from 'react';
import { useExpiringAccess } from '@/lib/access';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Heading } from '../../../components/ui/heading';
import { LoadState } from '../../../components/ui/query-state';
import { ReasonField } from '../../../components/ui/reason-field';
import { Notice, Button } from "../../../components/ui/primitives";
import { CriticalButton } from '../../../components/ui/critical-button';
import type { ReportMeta } from '../../corrections/shared';
import { PassportVisibilityForm } from '../../passport/visibility-form';
import { HoldForm } from '../../corrections/hold-form';

type ReportDetail = ReportMeta & { details: string; message: { body: string; sentAt: string } | null; listing: { id: string; version: number; status: string; itemId: string; passportVersion: number; passportVisibility: string } | null };

export function ReportDetailPage({ id }: { id: string }) {
  const me = useMe(); const [reason, setReason] = useState(''); const [expiresAt, setExpiresAt] = useState<string | null>(null); const access = useExpiringAccess(expiresAt, 'admin-report-detail', id);
  const queue = useQuery({ queryKey: ['admin-report-meta', id], queryFn: () => api<ReportMeta>(`/admin/reports/${id}/metadata`) });
  const row = queue.data;
  const detail = useQuery({ queryKey: ['admin-report-detail', id, access], enabled: access, queryFn: () => api<ReportDetail>(`/admin/reports/${id}`), retry: false });
  const own = row?.assignedAdminId === me.data?.id;
  return <><Link href="/app/admin/laporan" className="back-link">← Antrean laporan</Link><Heading eyebrow="ADMIN / KASUS" title={'Laporan ' + id.slice(0, 8)}>Isi laporan memerlukan penugasan dan akses selama lima menit.</Heading><LoadState query={queue} />{row && !access && <section className="app-panel form-stack"><p>{row.targetType} · {row.reasonCode} · {row.status}</p><ReasonField value={reason} onChange={setReason} />{!own ? row.assignedAdminId ? <Notice>Kasus ditugaskan kepada admin lain.</Notice> : <CriticalButton path={`/admin/reports/${id}/claim`} body={{ expectedVersion: row.version, reason }} title="Ambil laporan" description="Tetapkan laporan ini sebagai tugas peninjauanmu." disabled={reason.trim().length < 5}>Ambil penugasan</CriticalButton> : <CriticalButton path={`/admin/reports/${id}/access`} body={{ reason }} title="Buka isi laporan" description="Akses privat dicatat di audit dan berlaku selama lima menit." disabled={reason.trim().length < 5} onDone={(value) => setExpiresAt((value as { expiresAt: string }).expiresAt)}>Buka isi laporan</CriticalButton>}</section>}{!row && queue.data && !access && <Notice>Laporan tidak ditemukan dalam antrean terbuka.</Notice>}
    {access && <><LoadState query={detail} />{detail.isError && <Button variant="secondary" onClick={() => setExpiresAt(null)}>Perbarui alasan akses</Button>}{detail.data && <section className="app-panel form-stack"><h2>Konteks laporan</h2><p className="preserve-lines">{detail.data.details}</p>{detail.data.message && <blockquote>{detail.data.message.body}</blockquote>}<ReasonField value={reason} onChange={setReason} />{['OPEN', 'IN_REVIEW'].includes(detail.data.status) && <><div className="form-actions">{(['RESOLVED', 'DISMISSED'] as const).map((decision) => <CriticalButton key={decision} path={`/admin/reports/${id}/resolve`} body={{ expectedVersion: detail.data!.version, decision, reason }} title="Tutup laporan" description={`Catat putusan ${decision} untuk laporan ini.`} disabled={reason.trim().length < 5}>{decision === 'RESOLVED' ? 'Selesaikan laporan' : 'Tutup tanpa tindakan'}</CriticalButton>)}</div>{detail.data.listing && <><CriticalButton path={`/admin/listings/${detail.data.listing.id}/${detail.data.listing.status === 'SUSPENDED' ? 'release' : 'suspend'}`} body={{ reportId: id, expectedVersion: detail.data.listing.version, reason, ...(detail.data.listing.status === 'SUSPENDED' ? { withdraw: false } : {}) }} title="Moderasi Listing" description="Perubahan status Listing akan dicatat pada laporan ini." disabled={reason.trim().length < 5 || !['ACTIVE', 'SUSPENDED'].includes(detail.data.listing.status)}>{detail.data.listing.status === 'SUSPENDED' ? 'Kirim ke review ulang' : 'Tangguhkan Listing'}</CriticalButton><PassportVisibilityForm scopeType="REPORT" scopeId={id} itemId={detail.data.listing.itemId} version={detail.data.listing.passportVersion} current={detail.data.listing.passportVisibility} /></>}</>}<HoldForm scopeType="REPORT" scopeId={id} /></section>}</>}
  </>;
}
