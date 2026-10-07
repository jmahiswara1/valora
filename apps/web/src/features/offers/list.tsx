'use client';

import type { OfferDto, TransactionDto } from '@valora/contracts';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCriticalAction } from '../../hooks/use-critical-action';
import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Notice, Button, Field, Input } from "../../components/ui/primitives";
import { PrivatePhoto } from '../items/photo';
import { ActionFeedback } from '../../components/ui/action-feedback';
import { ConfirmAction } from '../../components/ui/confirm-dialog';
import { useMe } from '@/lib/session';
import { AccountSkeleton } from '../account/skeleton';
import { AccountError } from '../account/error';
import { money } from '../market/process-shared';

const offerStatus: Record<string, string> = { PENDING: 'Menunggu respons', COUNTERED: 'Counteroffer', ACCEPTED: 'Diterima', REJECTED: 'Ditolak', WITHDRAWN: 'Ditarik', EXPIRED: 'Kedaluwarsa' };

function OfferCard({ offer, userId }: { offer: OfferDto; userId: string }) {
  const cache = useQueryClient(); const router = useRouter(); const acceptAction = useCriticalAction('offer:' + offer.id, userId); const [acceptOpen, setAcceptOpen] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false); const [price, setPrice] = useState(String(offer.currentRevision?.priceIdr ?? '')); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const responding = useRef(false);
  const isBidder = offer.bidderId === userId;
  const isResponder = offer.currentRevision?.respondsById === userId;
  const open = ['PENDING', 'COUNTERED'].includes(offer.status);
  const action = useMutation({ mutationFn: (input: { path: string; body: unknown }) => api<OfferDto>(input.path, { method: 'POST', body: input.body }), onSuccess: async () => { setError(''); setNotice('Status penawaran diperbarui.'); setCounterOpen(false); await cache.invalidateQueries({ queryKey: ['offers'] }); }, onError: (cause) => { setError(cause instanceof Error ? cause.message : 'Perubahan belum tersimpan.'); void cache.invalidateQueries({ queryKey: ['offers'] }); }, onSettled: () => { responding.current = false; } });
  function decide(kind: 'reject' | 'withdraw') { if (responding.current || acceptAction.pending) return; responding.current = true; action.mutate({ path: `/offers/${offer.id}/${kind}`, body: { expectedVersion: offer.version } }); }
  function counter(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (responding.current || acceptAction.pending) return; responding.current = true; action.mutate({ path: `/offers/${offer.id}/counter`, body: { expectedVersion: offer.version, priceIdr: Number(price), ...(message.trim() ? { message: message.trim() } : {}) } }); }
  return <article className="offer-card"><div className="offer-card-head"><div><span className="eyebrow">{isBidder ? 'PENAWARAN SAYA' : 'DITERIMA'} · {offer.listing.type}</span><h2><Link href={`/market/${offer.listingId}`}>{offer.listing.title}</Link></h2></div><span className="badge">{offerStatus[offer.status]}</span></div>
    <div className="offer-card-price"><strong>{offer.currentRevision?.priceIdr === null || offer.currentRevision?.priceIdr === undefined ? 'Tanpa nominal' : money(offer.currentRevision.priceIdr)}</strong><span className="meta">Tenggat {new Date(offer.expiresAt).toLocaleDateString('id-ID')}</span></div>
    {offer.currentRevision?.message && <p className="offer-message">“{offer.currentRevision.message}”</p>}
    <p className="muted">{isBidder ? 'Kamu mengirim penawaran ini.' : 'Pemilik Listing dapat menanggapi atau menolak.'} Revisi penawaran {offer.currentRevision?.revisionNo ?? 1}.</p>
    {offer.status === 'ACCEPTED' && <Notice kind="success">Penawaran diterima. {offer.transactionId && <Link href={`/app/transaksi/${offer.transactionId}`}>Buka transaksi →</Link>}</Notice>}
    {error && <Notice kind="error">{error}</Notice>}{notice && <Notice kind="success">{notice}</Notice>}
    {offer.exchangeSnapshot && <div className="transaction-item"><PrivatePhoto mediaId={offer.exchangeSnapshot.mediaIds[0]} alt={offer.exchangeSnapshot.title} /><div><strong>Barang penukar: {offer.exchangeSnapshot.title}</strong><p>{offer.exchangeSnapshot.description}</p></div></div>}<ActionFeedback action={acceptAction} />{open && <div className="offer-card-actions">{isResponder && <Button onClick={() => setAcceptOpen(true)} disabled={acceptAction.pending || action.isPending}>Terima penawaran</Button>}{isResponder && offer.listing.type === 'RESELL' && <Button variant="secondary" disabled={acceptAction.pending || action.isPending} onClick={() => setCounterOpen((value) => !value)}>Buat counteroffer</Button>}{isResponder && <Button variant="quiet" onClick={() => decide('reject')} disabled={action.isPending || acceptAction.pending}>Tolak</Button>}{isBidder && <Button variant="quiet" onClick={() => decide('withdraw')} disabled={action.isPending || acceptAction.pending}>Tarik penawaran</Button>}</div>}
    {acceptOpen && <ConfirmAction title="Terima kesepakatan ini?" buttonLabel="Terima dan reservasi barang" pending={acceptAction.pending} onClose={() => setAcceptOpen(false)} onConfirm={async () => { if (!offer.currentRevision) return; const result = await acceptAction.run<TransactionDto>(`/offers/${offer.id}/accept`, { expectedVersion: offer.version, offerRevisionId: offer.currentRevision.id, listingRevisionId: offer.listingRevisionId }); if (result) { setAcceptOpen(false); router.push(`/app/transaksi/${result.id}`); } }}><p>{offer.listing.title} · {offer.listing.type} · {offer.currentRevision?.priceIdr ? money(offer.currentRevision.priceIdr) : 'Tanpa nominal'}</p><p>Barang terkait akan direservasi. Kepemilikan berubah setelah konfirmasi serah terima lengkap.</p>{offer.exchangeSnapshot && <p>Barang penukar: {offer.exchangeSnapshot.title}</p>}<ActionFeedback action={acceptAction} onRecovered={() => setAcceptOpen(false)} /></ConfirmAction>}
    {counterOpen && <form className="offer-counter-form" onSubmit={counter} aria-busy={action.isPending}><Field label="Nominal counteroffer" htmlFor={`counter-${offer.id}`}><Input id={`counter-${offer.id}`} disabled={action.isPending} required type="number" min="1" max="1000000000000" value={price} onChange={(e) => setPrice(e.target.value)} /></Field><Field label="Pesan (opsional)" htmlFor={`counter-message-${offer.id}`}><Input id={`counter-message-${offer.id}`} disabled={action.isPending} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} /></Field><Button type="submit" disabled={action.isPending}>Kirim counteroffer</Button></form>}
  </article>;
}

export function OffersPage() {
  const me = useMe();
  const offers = useQuery({ queryKey: ['offers', 'mine'], queryFn: () => api<OfferDto[]>('/offers/mine') });
  return <><div className="app-heading"><div><span className="eyebrow">AKUN / MARKET</span><h1>Penawaran</h1><p>Harga dan pesan disimpan pada revisi Offer, terpisah dari chat.</p></div></div>{offers.isPending ? <AccountSkeleton /> : offers.isError ? <AccountError retry={() => offers.refetch()}>Penawaran gagal dimuat.</AccountError> : offers.data.length && me.data ? <div className="offer-list">{offers.data.map((offer) => <OfferCard key={offer.id} offer={offer} userId={me.data!.id} />)}</div> : <div className="empty-state"><h3>Belum ada penawaran.</h3><p>Penawaran yang kamu kirim atau terima akan tercatat di sini.</p><Link className="button button-secondary" href="/market">Lihat Market</Link></div>}</>;
}

export function OfferDetail({ id }: { id: string }) {
  const me = useMe();
  const offer = useQuery({ queryKey: ['offers', 'detail', id], queryFn: () => api<OfferDto>(`/offers/${id}`), refetchOnWindowFocus: true });
  return <><div className="app-heading"><div><span className="eyebrow">AKUN / MARKET</span><h1>Detail penawaran</h1><p>Periksa usulan dan tanggapi penawaran yang terkait.</p></div><Link href="/app/penawaran" className="button button-secondary">Semua penawaran</Link></div>
    {offer.isPending ? <AccountSkeleton /> : offer.isError ? <AccountError retry={() => offer.refetch()}>Penawaran tidak tersedia atau tidak dapat diakses oleh akun ini.</AccountError> : me.data && <OfferCard offer={offer.data} userId={me.data.id} />}
  </>;
}
