'use client';

import { Select } from '@/components/ui/select';

import { useState } from 'react';
import { dateTime } from '../../lib/date';
import { ReasonField } from '../../components/ui/reason-field';
import { CriticalButton } from '../../components/ui/critical-button';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiEnvelope, api } from '@/lib/api';
import { useQueue, QueueMore } from '@/lib/queue';
import { Heading } from '../../components/ui/heading';
import { Field, Notice, Button } from "../../components/ui/primitives";
import { LoadState } from '../../components/ui/query-state';
import Link from 'next/link';

type AuditRow = { id: string; adminId: string; targetType: string; targetId: string; action: string; createdAt: string };

type HoldRow = { id: string; scopeType: string; scopeId: string; adminId: string; reviewAt: string; revokedAt: string | null; version: number };

function HoldRowView({ row }: { row: HoldRow }) { const [reason, setReason] = useState(''); return <article className="app-panel"><span className="eyebrow">{row.scopeType} · {row.scopeId.slice(0, 8)}</span><h3>{row.revokedAt ? 'Hold dicabut' : 'Review ' + dateTime(row.reviewAt)}</h3>{!row.revokedAt && <details className="operations-detail"><summary>Cabut penahanan kasus yang ditugaskan</summary><div className="form-stack"><ReasonField id={'release-hold-' + row.id} value={reason} onChange={setReason} /><CriticalButton path={`/admin/retention/holds/${row.id}/release`} body={{ expectedVersion: row.version, reason }} title="Cabut penahanan" description="Data akan kembali mengikuti jadwal retensi ketika kasus sudah ditutup." disabled={reason.trim().length < 5}>Cabut penahanan</CriticalButton></div></details>}</article>; }

export function AdminAuditPage() {
  const [target, setTarget] = useState(''); const rows = useInfiniteQuery({ queryKey: ['admin-audit', target], initialPageParam: null as string | null, queryFn: ({ pageParam }) => apiEnvelope<AuditRow[]>(`/admin/audit?targetType=${target}${pageParam ? '&cursor=' + encodeURIComponent(pageParam) : ''}`), getNextPageParam: (p) => p.meta?.nextCursor ?? undefined });
  const holds = useQueue<HoldRow>(['retention-holds'], '/admin/retention/holds');
  const runs = useQuery({ queryKey: ['retention-runs'], queryFn: () => api<{ id: string; status: string; startedAt: string; counts: { messages: number; cases: number; accounts: number; storage: number } | null }[]>('/admin/retention/runs') });
  return <><Heading eyebrow="ADMIN / AUDIT" title="Audit dan retensi">Jejak tindakan ditampilkan sebagai metadata. Isi kasus dibaca melalui akses yang ditugaskan.</Heading><Field label="Lingkup audit" htmlFor="audit-target"><Select id="audit-target" className="select" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Semua lingkup</option>{['USER', 'REPORT', 'DISPUTE', 'CORRECTION', 'RUBRIC_DRAFT', 'ECONOMIC_REFERENCE'].map((t) => <option key={t}>{t}</option>)}</Select></Field><LoadState query={rows} /><ol className="audit-list">{rows.data?.pages.flatMap((p) => p.data).map((row) => <li key={row.id}><time>{dateTime(row.createdAt)}</time><strong>{row.action}</strong><span>{row.targetType} · {row.targetId.slice(0, 8)} · admin {row.adminId.slice(0, 8)}</span>{row.targetType === 'REPORT' && <Link href={`/app/admin/laporan/${row.targetId}`}>Konteks laporan →</Link>}{row.targetType === 'CORRECTION' && <Link href={`/app/admin/koreksi/${row.targetId}`}>Konteks koreksi →</Link>}{row.targetType === 'DISPUTE' && <Link href={`/app/admin/sengketa/${row.targetId}`}>Konteks sengketa →</Link>}</li>)}</ol>{rows.data && !rows.data.pages[0].data.length && <Notice>Belum ada tindakan dalam lingkup ini.</Notice>}{rows.hasNextPage && <Button onClick={() => rows.fetchNextPage()} disabled={rows.isFetchingNextPage}>Muat audit berikutnya</Button>}<section className="section-tight"><h2>Penahanan retensi</h2><LoadState query={holds} /><div className="operations-list">{holds.data?.map((row) => <HoldRowView row={row} key={row.id} />)}</div>{holds.data && !holds.data.length && <p>Belum ada penahanan.</p>}<QueueMore query={holds} /></section><section className="section-tight"><h2>Hasil pemeliharaan</h2><LoadState query={runs} /><ul className="audit-list">{runs.data?.map((run) => <li key={run.id}><time>{dateTime(run.startedAt)}</time><strong>{run.status}</strong>{run.counts && <span>{run.counts.messages} pesan · {run.counts.cases} konteks kasus · {run.counts.accounts} akun · {run.counts.storage} berkas dibersihkan</span>}</li>)}</ul></section></>;
}
