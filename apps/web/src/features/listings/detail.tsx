'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import type { ListingDto, ItemDto } from '@valora/contracts';
import { useState, useRef } from 'react';
import { AccountSkeleton } from '../account/skeleton';
import { Notice, Field, Input, Button } from "../../components/ui/primitives";
import Link from 'next/link';
import { listingTypeLabel as typeLabel, listingConditionLabel as conditionLabel, listingMoney as money } from '../market/labels';
import { ConfirmAction } from '../../components/ui/confirm-dialog';
import { listingStatus } from './shared';

export function ListingOwnerDetail({ id }: { id: string }) {
  const router = useRouter(); const cache = useQueryClient();
  const listing = useQuery({ queryKey: ['listings', id], queryFn: () => api<ListingDto>(`/listings/${id}`) });
  const item = useQuery({ queryKey: ['items', listing.data?.itemId], queryFn: () => api<ItemDto>(`/items/${listing.data!.itemId}`), enabled: Boolean(listing.data?.itemId) });
  const [titleEdit, setTitleEdit] = useState<string | null>(null); const [descriptionEdit, setDescriptionEdit] = useState<string | null>(null); const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const ownerRunning = useRef(false); const [ownerBusy, setOwnerBusy] = useState(false); const [withdrawOpen, setWithdrawOpen] = useState(false);
  const title = titleEdit ?? listing.data?.currentRevision?.title ?? '';
  const description = descriptionEdit ?? listing.data?.currentRevision?.description ?? '';
  const mutation = useMutation({ mutationFn: async () => {
    if (!listing.data?.currentRevision || !item.data) throw new Error('Revisi Listing belum tersedia.');
    const rev = listing.data.currentRevision;
    const common = { assessmentId: rev.assessmentId, expectedItemVersion: item.data.version, expectedVersion: listing.data.version, title, description, mediaIds: rev.media.map((media) => media.id), cityId: rev.city.id, conditionDisclosure: rev.conditionDisclosure, handoverMethods: rev.handoverMethods, copyOnlyCorrection: true, type: listing.data.type };
    const body = listing.data.type === 'RESELL' ? { ...common, type: 'RESELL', askingPriceIdr: rev.askingPriceIdr! } : listing.data.type === 'EXCHANGE' ? { ...common, type: 'EXCHANGE', exchangePreference: rev.exchangePreference! } : { ...common, type: 'DONATE', recipientNote: rev.recipientNote };
    const updated = await api<ListingDto>(`/listings/${id}`, { method: 'PATCH', body });
    return updated;
  }, onSuccess: async () => { await cache.invalidateQueries({ queryKey: ['listings'] }); setNotice('Koreksi teks disimpan. Kirim ulang Listing ke review.'); setError(''); }, onError: (cause) => setError(cause instanceof ApiClientError && cause.code === 'STATE_CONFLICT' ? 'Listing telah berubah. Muat ulang detail sebelum menyimpan lagi.' : cause instanceof Error ? cause.message : 'Perubahan belum tersimpan.'), onSettled: () => { ownerRunning.current = false; } });
  async function submitReview() { if (!listing.data || ownerRunning.current) return; ownerRunning.current = true; setOwnerBusy(true); setError(''); try { await api(`/listings/${id}/submit`, { method: 'POST', body: { expectedVersion: listing.data.version } }); await cache.invalidateQueries({ queryKey: ['listings'] }); setNotice('Listing dikirim untuk review.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Listing belum diajukan.'); } finally { ownerRunning.current = false; setOwnerBusy(false); } }
  async function withdraw() { if (!listing.data || ownerRunning.current) return; ownerRunning.current = true; setOwnerBusy(true); setError(''); try { await api(`/listings/${id}/withdraw`, { method: 'POST', body: { expectedVersion: listing.data.version } }); await cache.invalidateQueries({ queryKey: ['listings'] }); setWithdrawOpen(false); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Listing belum ditarik.'); } finally { ownerRunning.current = false; setOwnerBusy(false); } }
  if (listing.isPending) return <AccountSkeleton />;
  if (listing.isError || !listing.data) return <Notice kind="error">Listing tidak ditemukan.</Notice>;
  const row = listing.data; const rev = row.currentRevision;
  return <><div className="app-heading"><div><span className="badge">{listingStatus[row.status]}</span><h1>{rev?.title ?? 'Draft Listing'}</h1><p>{rev?.city.name ?? 'Lokasi belum diatur'} · revisi {rev?.revisionNo ?? 0}</p></div><Link href="/app/listings" className="button button-secondary">Semua Listing</Link></div>
    {row.status === 'PENDING_REVIEW' && <Notice>Listing sedang ditinjau. Kamu dapat menariknya untuk melakukan perubahan.</Notice>}
    {row.status === 'ACTIVE' && <Notice kind="success">Listing sedang tampil di Market. Perubahan teks akan menjeda penawaran sampai review berikutnya selesai.</Notice>}
    {rev && <div className="listing-owner-layout"><section className="app-panel"><h2>Ringkasan Listing</h2><p>{rev.description}</p><div className="detail-list"><div><dt>Jenis</dt><dd>{typeLabel[row.type]}</dd></div><div><dt>Kondisi</dt><dd>{conditionLabel(rev.condition)} · Score {rev.score ?? 'belum tersedia'}</dd></div><div><dt>Penilaian</dt><dd>{rev.ruleVersion}</dd></div><div><dt>Harga</dt><dd>{rev.askingPriceIdr === null ? '—' : money(rev.askingPriceIdr)}</dd></div><div><dt>Serah terima</dt><dd>{rev.handoverMethods.map((method) => method === 'MEETUP' ? 'Bertemu langsung' : 'Pengiriman').join(' · ')}</dd></div></div></section>
    <form className="app-panel form-stack" onSubmit={(e) => { e.preventDefault(); if (ownerRunning.current) return; ownerRunning.current = true; mutation.mutate(); }} aria-busy={mutation.isPending || ownerBusy}><h2>Perbarui judul atau deskripsi.</h2><p>Perubahan fakta kondisi, foto, harga, kota, atau serah terima dilakukan lewat Item atau revisi Listing dan memerlukan Assessment terkini.</p><Field label="Judul" htmlFor="owner-listing-title"><Input id="owner-listing-title" disabled={ownerBusy || mutation.isPending} value={title} onChange={(e) => setTitleEdit(e.target.value)} minLength={3} maxLength={120} required /></Field><Field label="Deskripsi" htmlFor="owner-listing-description"><textarea className="textarea" id="owner-listing-description" disabled={ownerBusy || mutation.isPending} value={description} onChange={(e) => setDescriptionEdit(e.target.value)} minLength={10} maxLength={3000} required /></Field>{error && <Notice kind="error">{error} <Button type="button" variant="quiet" onClick={() => { void listing.refetch(); void item.refetch(); }}>Muat ulang detail</Button></Notice>}{notice && <Notice kind="success">{notice}</Notice>}<div className="form-actions"><Button type="submit" disabled={ownerBusy || mutation.isPending || ['RESERVED', 'CLOSED', 'WITHDRAWN', 'SUSPENDED'].includes(row.status)}>{mutation.isPending ? 'Menyimpan…' : 'Simpan koreksi teks'}</Button>{['DRAFT', 'PAUSED', 'REJECTED'].includes(row.status) && <Button type="button" variant="secondary" disabled={ownerBusy || mutation.isPending} onClick={submitReview}>Kirim untuk review</Button>}{['ACTIVE', 'PAUSED', 'PENDING_REVIEW', 'DRAFT', 'REJECTED'].includes(row.status) && <Button type="button" variant="danger" disabled={ownerBusy || mutation.isPending} onClick={() => { setError(''); setWithdrawOpen(true); }}>Tarik Listing</Button>}</div></form></div>}{withdrawOpen && <ConfirmAction title="Tarik Listing" buttonLabel="Tarik Listing" pending={ownerBusy} onClose={() => setWithdrawOpen(false)} onConfirm={withdraw}><p>Listing akan ditarik dan penawaran yang belum selesai akan berakhir.</p>{error && <Notice kind="error">{error}</Notice>}</ConfirmAction>}</>;
}
