'use client';

import { Select } from '@/components/ui/select';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiEnvelope } from '@/lib/api';
import { Field, Input, Button, Notice } from "../../../components/ui/primitives";
import { ReasonField } from '../../../components/ui/reason-field';
import { CriticalButton } from '../../../components/ui/critical-button';
import { Heading } from '../../../components/ui/heading';
import { LoadState } from '../../../components/ui/query-state';
import { dateTime } from '../../../lib/date';

type UserRow = { id: string; displayName: string; email: string; role: string; status: string; version: number; createdAt: string };

function UserActions({ row }: { row: UserRow }) { const [reason, setReason] = useState(''); return <details className="operations-detail"><summary>Kelola {row.displayName}</summary><div className="form-stack"><ReasonField id={'user-reason-' + row.id} value={reason} onChange={setReason} />{row.role !== 'ADMIN' && row.status !== 'CLOSED' ? <CriticalButton path={`/admin/users/${row.id}/${row.status === 'SUSPENDED' ? 'release' : 'suspend'}`} body={{ expectedVersion: row.version, reason }} title="Ubah status akun" description={`${row.displayName}: ${row.status === 'SUSPENDED' ? 'Aktifkan akses akun. Listing lama perlu ditinjau kembali.' : 'Tangguhkan akses, cabut sesi, dan tindak lanjuti transaksi aktif melalui kasus.'}`} disabled={reason.trim().length < 5} danger={row.status !== 'SUSPENDED'}>{row.status === 'SUSPENDED' ? 'Aktifkan akun' : 'Tangguhkan akun'}</CriticalButton> : <p>Status akun ini tidak dapat diubah lewat moderasi.</p>}</div></details>; }

export function AdminUsersPage() {
  const [q, setQ] = useState(''); const [draftQ, setDraftQ] = useState(''); const [status, setStatus] = useState('');
  const result = useInfiniteQuery({ queryKey: ['admin-users', q, status], initialPageParam: null as string | null, queryFn: ({ pageParam }) => apiEnvelope<UserRow[]>(`/admin/users?q=${encodeURIComponent(q)}&status=${status}${pageParam ? '&cursor=' + encodeURIComponent(pageParam) : ''}`), getNextPageParam: (p) => p.meta?.nextCursor ?? undefined });
  const rows = result.data?.pages.flatMap((p) => p.data) ?? [];
  return <><Heading eyebrow="ADMIN / PENGGUNA" title="Pengguna">Tinjau akun dan catat perubahan status dengan alasan.</Heading><form className="operations-filters" onSubmit={(e) => { e.preventDefault(); setQ(draftQ); }}><Field label="Cari nama atau email" htmlFor="users-search"><Input id="users-search" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} maxLength={120} /></Field><Field label="Status akun" htmlFor="users-status"><Select className="select" id="users-status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua</option>{['ACTIVE', 'SUSPENDED', 'CLOSED'].map((s) => <option key={s}>{s}</option>)}</Select></Field><Button type="submit">Cari</Button></form><LoadState query={result} /><div className="operations-list">{rows.map((row) => <article className="app-panel" key={row.id}><span className="badge">{row.status}</span><h2>{row.displayName}</h2><p>{row.email} · {row.role}</p><small>Terdaftar {dateTime(row.createdAt)}</small><UserActions row={row} /></article>)}</div>{!result.isPending && !result.isError && !rows.length && <Notice>Tidak ada akun sesuai filter.</Notice>}{result.hasNextPage && <Button disabled={result.isFetchingNextPage} onClick={() => result.fetchNextPage()}>Muat pengguna berikutnya</Button>}</>;
}
