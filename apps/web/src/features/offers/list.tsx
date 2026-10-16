'use client';

import type { OfferDto, TransactionDto } from '@valora/contracts';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCriticalAction } from '../../hooks/use-critical-action';
import { useState, useRef } from 'react';
import { ExchangeTermsView } from '@/features/exchange/terms';
import { CounterForm } from '@/features/exchange/counter';
import { OfferHistory } from '@/features/exchange/history';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Notice, Button } from "../../components/ui/primitives";
import { PrivatePhoto } from '../items/photo';
import { ActionFeedback } from '../../components/ui/action-feedback';
import { ConfirmAction } from '../../components/ui/confirm-dialog';
import { useMe } from '@/lib/session';
import { AccountSkeleton } from '../account/skeleton';
import { AccountError } from '../account/error';
import { money } from '../market/process-shared';

const offerStatus: Record<string, string> = { PENDING: 'Menunggu respons', COUNTERED: 'Counteroffer', ACCEPTED: 'Diterima', REJECTED: 'Ditolak', WITHDRAWN: 'Ditarik', EXPIRED: 'Kedaluwarsa' };

function OfferCard({ offer, userId, detailed = false }: { offer: OfferDto; userId: string; detailed?: boolean }) {
  const cache = useQueryClient(), router = useRouter();
  const acceptAction = useCriticalAction('offer:' + offer.id, userId);
  const [acceptOffer, setAcceptOffer] = useState<OfferDto | null>(null), [counterOffer, setCounterOffer] = useState<OfferDto | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''); const responding = useRef(false);
  const isBidder = offer.bidderId === userId, isResponder = offer.currentRevision?.respondsById === userId;
  const open = ['PENDING', 'COUNTERED'].includes(offer.status), terms = offer.currentRevision?.exchangeTerms;
  const action = useMutation({ mutationFn: (input: { path: string; body: unknown }) => api<OfferDto>(input.path, { method: 'POST', body: input.body }), onSuccess: async () => { setError(''); setNotice('Status penawaran diperbarui.'); setCounterOffer(null); await cache.invalidateQueries({ queryKey: ['offers'] }); }, onError: cause => { setError(cause instanceof Error ? cause.message : 'Perubahan belum tersimpan.'); void cache.invalidateQueries({ queryKey: ['offers'] }); }, onSettled: () => { responding.current = false; } });
  function mutate(path: string, body: unknown) { if (responding.current || acceptAction.pending || acceptAction.hasSaved()) return; responding.current = true; action.mutate({ path, body }); }
  const blocked = acceptAction.pending || action.isPending || acceptAction.hasSaved();
  return <article className="offer-card"><div className="offer-card-head"><div><span className="eyebrow">{isBidder ? 'PENAWARAN SAYA' : 'DITERIMA'} · {offer.listing.type}</span><h2><Link href={'/market/' + offer.listingId}>{offer.listing.title}</Link></h2></div><span className="badge">{offerStatus[offer.status]}</span></div>
    <div className="offer-card-price"><strong>{offer.listing.type === 'EXCHANGE' ? terms?.cashAdjustment ? 'Tambahan ' + money(terms.cashAdjustment.amountIdr) : 'Tukar barang' : offer.currentRevision?.priceIdr ? money(offer.currentRevision.priceIdr) : 'Tanpa nominal'}</strong><span className="meta">Tenggat {new Date(offer.expiresAt).toLocaleDateString('id-ID')}</span></div>
    {offer.currentRevision?.message && <p className="offer-message">“{offer.currentRevision.message}”</p>}<p className="muted">Revisi {offer.currentRevision?.revisionNo ?? 1} · {isResponder ? 'Menunggu tanggapanmu.' : open ? 'Menunggu tanggapan pihak lain.' : offerStatus[offer.status]}</p>
    {terms ? detailed ? <ExchangeTermsView terms={terms} ownerLabel={isBidder ? 'pemilik Listing' : 'kamu'} bidderLabel={isBidder ? 'kamu' : 'penawar'} /> : <p>Pemilik Listing: {terms.ownerItems.length} barang · Penawar: {terms.bidderItems.length} barang</p> : offer.exchangeSnapshot && <div className="transaction-item"><PrivatePhoto mediaId={offer.exchangeSnapshot.mediaIds[0]} alt={offer.exchangeSnapshot.title} /><div><strong>Barang penukar: {offer.exchangeSnapshot.title}</strong><p>{offer.exchangeSnapshot.description}</p></div></div>}
    {!detailed && <Link href={'/app/penawaran/' + offer.id}>Lihat seluruh kesepakatan</Link>}
    {offer.status === 'ACCEPTED' && <Notice kind="success">Penawaran diterima. {offer.transactionId && <Link href={'/app/transaksi/' + offer.transactionId}>Buka transaksi</Link>}</Notice>}{error && <Notice kind="error">{error}</Notice>}{notice && <Notice kind="success">{notice}</Notice>}<ActionFeedback action={acceptAction} />
    {open && <div className="offer-card-actions">{isResponder && <Button onClick={() => setAcceptOffer(offer)} disabled={blocked}>Terima penawaran</Button>}{isResponder && (offer.listing.type === 'RESELL' || offer.listing.type === 'EXCHANGE' && terms) && <Button variant="secondary" disabled={blocked} onClick={() => setCounterOffer(counterOffer ? null : offer)}>Buat counteroffer</Button>}{isResponder && <Button variant="quiet" onClick={() => mutate('/offers/' + offer.id + '/reject', { expectedVersion: offer.version })} disabled={blocked}>Tolak</Button>}{isBidder && <Button variant="quiet" onClick={() => mutate('/offers/' + offer.id + '/withdraw', { expectedVersion: offer.version })} disabled={blocked}>Tarik penawaran</Button>}</div>}
    {counterOffer && <CounterForm offer={counterOffer} userId={userId} pending={action.isPending} stale={!open || !isResponder || counterOffer.version !== offer.version} onSubmit={body => mutate('/offers/' + offer.id + '/counter', body)} onClose={() => setCounterOffer(null)} />}
    {detailed && <OfferHistory id={offer.id} version={offer.version} />}
    {acceptOffer && <ConfirmAction title="Terima kesepakatan ini?" buttonLabel="Terima dan reservasi barang" pending={acceptAction.pending} onClose={() => setAcceptOffer(null)} acknowledgement="Saya sudah meninjau seluruh barang, tambahan uang, dan kewajiban konfirmasinya." onConfirm={async () => { const revision = acceptOffer.currentRevision; if (!revision) return; const result = await acceptAction.run<TransactionDto>('/offers/' + offer.id + '/accept', { expectedVersion: acceptOffer.version, offerRevisionId: revision.id, listingRevisionId: acceptOffer.listingRevisionId, ...(revision.termsHash ? { exchangeTermsHash: revision.termsHash } : {}) }); if (result) { setAcceptOffer(null); router.push('/app/transaksi/' + result.id); } }}><h3>{acceptOffer.listing.title}</h3>{acceptOffer.currentRevision?.exchangeTerms ? <ExchangeTermsView terms={acceptOffer.currentRevision.exchangeTerms} /> : <><p>{acceptOffer.currentRevision?.priceIdr ? money(acceptOffer.currentRevision.priceIdr) : 'Tanpa nominal'}</p>{acceptOffer.exchangeSnapshot && <p>Barang penukar: {acceptOffer.exchangeSnapshot.title}</p>}</>}<p>Seluruh barang terkait akan direservasi. Kepemilikan berpindah setelah seluruh konfirmasi barang dan tambahan uang, bila ada, lengkap.</p><ActionFeedback action={acceptAction} onRecovered={() => setAcceptOffer(null)} /></ConfirmAction>}
  </article>;
}

export function OffersPage() {
  const me = useMe();
  const offers = useQuery({ queryKey: ['offers', 'mine'], queryFn: () => api<OfferDto[]>('/offers/mine') });
  return <><div className="app-heading"><div><span className="eyebrow">AKUN / MARKET</span><h1>Penawaran</h1><p>Barang, nominal, dan pesan disepakati melalui revisi penawaran.</p></div></div>{offers.isPending ? <AccountSkeleton /> : offers.isError ? <AccountError retry={() => offers.refetch()}>Penawaran gagal dimuat.</AccountError> : offers.data.length && me.data ? <div className="offer-list">{offers.data.map((offer) => <OfferCard key={offer.id} offer={offer} userId={me.data!.id} />)}</div> : <div className="empty-state"><h3>Belum ada penawaran.</h3><p>Penawaran yang kamu kirim atau terima akan tercatat di sini.</p><Link className="button button-secondary" href="/market">Lihat Market</Link></div>}</>;
}

export function OfferDetail({ id }: { id: string }) {
  const me = useMe();
  const offer = useQuery({ queryKey: ['offers', 'detail', id], queryFn: () => api<OfferDto>(`/offers/${id}`), refetchOnWindowFocus: true });
  return <><div className="app-heading"><div><span className="eyebrow">AKUN / MARKET</span><h1>Detail penawaran</h1><p>Periksa usulan dan tanggapi penawaran yang terkait.</p></div><Link href="/app/penawaran" className="button button-secondary">Semua penawaran</Link></div>
    {offer.isPending ? <AccountSkeleton /> : offer.isError ? <AccountError retry={() => offer.refetch()}>Penawaran tidak tersedia atau tidak dapat diakses oleh akun ini.</AccountError> : me.data && <OfferCard offer={offer.data} userId={me.data.id} detailed />}
  </>;
}
