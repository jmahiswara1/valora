'use client';

import type { OfferDto, TransactionDto } from '@valora/contracts';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCriticalAction } from '../../hooks/use-critical-action';
import { useEffect, useState, useRef } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { ExchangeTermsView } from '@/features/exchange/terms';
import { CounterForm } from '@/features/exchange/counter';
import { OfferHistory } from '@/features/exchange/history';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Notice, Button, Field } from "../../components/ui/primitives";
import { Select } from '@/components/ui/select';
import { PrivatePhoto } from '../items/photo';
import { ActionFeedback } from '../../components/ui/action-feedback';
import { ConfirmAction } from '../../components/ui/confirm-dialog';
import { useMe } from '@/lib/session';
import { AccountSkeleton } from '../account/skeleton';
import { AccountError } from '../account/error';
import { money } from '../market/process-shared';
import { listingTypeLabel } from '../market/labels';
import { CollectionSearch, CollectionTypes } from '../account/collection-controls';
import { offerPhase, offerStatusLabel as offerStatus } from './phase';
import { OfferListRow } from './list-row';
import '@/styles/account-collections.css';

function useOfferNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  return now;
}

function OfferCard({ offer, userId, now }: { offer: OfferDto; userId: string; now: number }) {
  const cache = useQueryClient(), router = useRouter();
  const acceptAction = useCriticalAction('offer:' + offer.id, userId);
  const [acceptOffer, setAcceptOffer] = useState<OfferDto | null>(null), [counterOffer, setCounterOffer] = useState<OfferDto | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''); const responding = useRef(false);
  const isBidder = offer.bidderId === userId, isResponder = offer.currentRevision?.respondsById === userId;
  const phase = offerPhase(offer, userId, now), open = phase !== 'finished', terms = offer.currentRevision?.exchangeTerms;
  const status = !offer.currentRevision && open ? 'Rincian belum tersedia' : phase === 'response' ? 'Perlu tanggapan' : phase === 'waiting' ? 'Menunggu balasan' : ['PENDING', 'COUNTERED'].includes(offer.status) ? 'Kedaluwarsa' : offerStatus[offer.status];
  const action = useMutation({ mutationFn: (input: { path: string; body: unknown }) => api<OfferDto>(input.path, { method: 'POST', body: input.body }), onSuccess: async () => { setError(''); setNotice('Status penawaran diperbarui.'); setCounterOffer(null); await cache.invalidateQueries({ queryKey: ['offers'] }); }, onError: cause => { setError(cause instanceof Error ? cause.message : 'Perubahan belum tersimpan.'); void cache.invalidateQueries({ queryKey: ['offers'] }); }, onSettled: () => { responding.current = false; } });
  function mutate(path: string, body: unknown) { if (responding.current || acceptAction.pending || acceptAction.hasSaved()) return; responding.current = true; action.mutate({ path, body }); }
  const blocked = acceptAction.pending || action.isPending || acceptAction.hasSaved() || !offer.currentRevision;
  const actions = open && offer.currentRevision && <div className="offer-card-actions" role="group" aria-label="Tanggapan penawaran">{isResponder && <Button onClick={() => setAcceptOffer(offer)} disabled={blocked}>Terima penawaran</Button>}{isResponder && (offer.listing.type === 'RESELL' || offer.listing.type === 'EXCHANGE' && terms) && <Button variant="secondary" disabled={blocked} onClick={() => setCounterOffer(counterOffer ? null : offer)} aria-expanded={!!counterOffer}>Ajukan tawaran balik</Button>}{isResponder && <Button variant="secondary" className="offer-decline" onClick={() => mutate('/offers/' + offer.id + '/reject', { expectedVersion: offer.version })} disabled={blocked}>Tolak penawaran</Button>}{isBidder && <Button variant="secondary" onClick={() => mutate('/offers/' + offer.id + '/withdraw', { expectedVersion: offer.version })} disabled={blocked}>Tarik penawaran</Button>}</div>;
  return <article className="offer-card" data-offer-id={offer.id}><div className="offer-card-head"><div><h2>{offer.listing.title}</h2><p className="meta">{isBidder ? 'Penawaran keluar' : 'Penawaran masuk'} · {listingTypeLabel[offer.listing.type]}</p></div><span className="badge">{status}</span></div>
    <Link href={'/market/' + offer.listingId} className="offer-market-link">Lihat barang di Market <ArrowUpRight size={15} aria-hidden="true" /></Link>
    <div className="offer-card-price"><strong>{offer.listing.type === 'EXCHANGE' ? terms?.cashAdjustment ? 'Tambahan ' + money(terms.cashAdjustment.amountIdr) : 'Tanpa tambahan uang' : offer.listing.type === 'DONATE' ? 'Tanpa biaya' : offer.currentRevision?.priceIdr == null ? 'Nominal belum tersedia' : money(offer.currentRevision.priceIdr)}</strong>{open && <time className="meta" dateTime={offer.expiresAt}>Batas tanggapan {new Date(offer.expiresAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</time>}</div>
    {offer.currentRevision?.message && <p className="offer-message">“{offer.currentRevision.message}”</p>}<p className="muted">{offer.currentRevision && `Revisi ${offer.currentRevision.revisionNo} · `}{phase === 'response' ? 'Periksa seluruh rincian sebelum memilih tanggapan.' : phase === 'waiting' ? 'Menunggu tanggapan pihak lain.' : status}</p>
    {terms ? <ExchangeTermsView terms={terms} ownerLabel={isBidder ? 'pemilik Listing' : 'kamu'} bidderLabel={isBidder ? 'kamu' : 'penawar'} /> : offer.exchangeSnapshot && <div className="transaction-item"><PrivatePhoto mediaId={offer.exchangeSnapshot.mediaIds[0]} alt={offer.exchangeSnapshot.title} /><div><strong>Barang penukar: {offer.exchangeSnapshot.title}</strong><p>{offer.exchangeSnapshot.description}</p></div></div>}
    {offer.status === 'ACCEPTED' && <div className="offer-detail-next"><p>{offer.transactionId ? 'Penawaran diterima. Lihat progres dan serah terima di halaman transaksi.' : 'Penawaran diterima. Rincian transaksi belum tersedia.'}</p>{offer.transactionId && <Link href={'/app/transaksi/' + offer.transactionId} className="button button-primary">Buka transaksi <ArrowRight size={16} aria-hidden="true" /></Link>}</div>}{error && <Notice kind="error">{error}</Notice>}{notice && <Notice kind="success">{notice}</Notice>}{(acceptAction.notice || acceptAction.error || acceptAction.notFound) && <ActionFeedback action={acceptAction} />}
    {actions}
    {counterOffer && <CounterForm offer={counterOffer} userId={userId} pending={action.isPending} stale={!open || !isResponder || counterOffer.version !== offer.version} onSubmit={body => mutate('/offers/' + offer.id + '/counter', body)} onClose={() => setCounterOffer(null)} />}
    <OfferHistory id={offer.id} version={offer.version} />
    {acceptOffer && <ConfirmAction title="Terima kesepakatan ini?" buttonLabel="Terima dan reservasi barang" pending={acceptAction.pending} onClose={() => setAcceptOffer(null)} acknowledgement="Saya sudah meninjau seluruh barang, tambahan uang, dan kewajiban konfirmasinya." onConfirm={async () => { const revision = acceptOffer.currentRevision; if (!revision) return; const result = await acceptAction.run<TransactionDto>('/offers/' + offer.id + '/accept', { expectedVersion: acceptOffer.version, offerRevisionId: revision.id, listingRevisionId: acceptOffer.listingRevisionId, ...(revision.termsHash ? { exchangeTermsHash: revision.termsHash } : {}) }); if (result) { setAcceptOffer(null); router.push('/app/transaksi/' + result.id); } }}><h3>{acceptOffer.listing.title}</h3>{acceptOffer.currentRevision?.exchangeTerms ? <ExchangeTermsView terms={acceptOffer.currentRevision.exchangeTerms} /> : <><p>{acceptOffer.currentRevision?.priceIdr ? money(acceptOffer.currentRevision.priceIdr) : 'Tanpa nominal'}</p>{acceptOffer.exchangeSnapshot && <p>Barang penukar: {acceptOffer.exchangeSnapshot.title}</p>}</>}<p>Seluruh barang terkait akan direservasi. Kepemilikan berpindah setelah seluruh konfirmasi barang dan tambahan uang, bila ada, lengkap.</p><ActionFeedback action={acceptAction} onRecovered={() => setAcceptOffer(null)} /></ConfirmAction>}
  </article>;
}

export function OffersPage() {
  const me = useMe();
  const offers = useQuery({ queryKey: ['offers', 'mine'], queryFn: () => api<OfferDto[]>('/offers/mine'), refetchOnWindowFocus: true, refetchInterval: 30000 });
  const [filters, setFilters] = useState({ phase: '', direction: '', type: '', search: '' });
  const now = useOfferNow();
  const userId = me.data?.id ?? '', hasFilters = Object.values(filters).some(Boolean);
  const filtered = offers.data?.filter(offer => (!filters.phase || offerPhase(offer, userId, now) === filters.phase) && (!filters.direction || (offer.bidderId === userId ? 'outgoing' : 'incoming') === filters.direction) && (!filters.type || offer.listing.type === filters.type) && offer.listing.title.toLocaleLowerCase('id-ID').includes(filters.search.trim().toLocaleLowerCase('id-ID'))) ?? [];
  const rows = [...filtered.filter(offer => offerPhase(offer, userId, now) === 'response'), ...filtered.filter(offer => offerPhase(offer, userId, now) !== 'response')];
  return <div className="account-collection-page offers-page"><div className="app-heading"><div><h1>Penawaran</h1><p>Tinjau detail sebelum menanggapi. Penawaran yang diterima dilanjutkan di Transaksi.</p></div></div>
    <div className="collection-toolbar"><div className="offer-phase-filters" role="group" aria-label="Aktivitas penawaran">{[['', 'Semua'], ['response', 'Perlu tanggapan'], ['waiting', 'Menunggu pihak lain'], ['finished', 'Selesai']].map(([value, label]) => <button type="button" key={value} aria-pressed={filters.phase === value} onClick={() => setFilters(current => ({ ...current, phase: value }))}>{label}</button>)}</div>
      <div className="collection-search-row"><CollectionSearch id="offer-search" label="Cari penawaran" value={filters.search} onChange={search => setFilters(current => ({ ...current, search }))} /><Field label="Arah penawaran" htmlFor="offer-direction"><Select id="offer-direction" className="select" value={filters.direction} onChange={event => setFilters(current => ({ ...current, direction: event.target.value }))}><option value="">Semua arah</option><option value="incoming">Masuk</option><option value="outgoing">Keluar</option></Select></Field></div>
      <div className="collection-filter-footer"><CollectionTypes label="Jenis penawaran" value={filters.type} onChange={type => setFilters(current => ({ ...current, type }))} /></div>
    </div>
    {offers.isPending ? <AccountSkeleton /> : offers.isError ? <AccountError retry={() => offers.refetch()}>Penawaran gagal dimuat.</AccountError> : <>
      <div className="collection-result-header"><p className="collection-result-count" role="status">{rows.length} penawaran ditampilkan{offers.data.length === 100 ? ' · 100 penawaran terbaru' : ''}</p><Button variant="quiet" disabled={!hasFilters} onClick={() => setFilters({ phase: '', direction: '', type: '', search: '' })}>Reset filter</Button></div>
      {rows.length && me.data ? <div className="offer-list">{rows.map(offer => <OfferListRow key={offer.id} offer={offer} userId={userId} now={now} />)}</div> : <div className="empty-state"><h3>{hasFilters ? 'Tidak ada penawaran yang cocok.' : 'Belum ada penawaran.'}</h3><p>{hasFilters ? 'Coba nama, jenis, arah, atau aktivitas lain.' : 'Penawaran yang kamu kirim atau terima akan tercatat di sini.'}</p>{hasFilters ? <Button variant="secondary" onClick={() => setFilters({ phase: '', direction: '', type: '', search: '' })}>Tampilkan semua</Button> : <Link className="button button-secondary" href="/market">Lihat Market</Link>}</div>}
    </>}
  </div>;
}

export function OfferDetail({ id }: { id: string }) {
  const me = useMe();
  const now = useOfferNow();
  const offer = useQuery({ queryKey: ['offers', 'detail', id], queryFn: () => api<OfferDto>(`/offers/${id}`), refetchOnWindowFocus: true });
  return <><div className="app-heading"><div><h1>Detail penawaran</h1><p>Periksa rincian kesepakatan. Pilihan tanggapan tersedia saat giliranmu.</p></div><Link href="/app/penawaran" className="button button-secondary">Semua penawaran</Link></div>
    {offer.isPending ? <AccountSkeleton /> : offer.isError ? <AccountError retry={() => offer.refetch()}>Penawaran tidak tersedia atau tidak dapat diakses oleh akun ini.</AccountError> : me.data && <OfferCard offer={offer.data} userId={me.data.id} now={now} />}
  </>;
}
