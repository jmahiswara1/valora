'use client';
import { MarketOwnerProfile } from './owner';

import { Select } from '@/components/ui/select';

import type { PublicListingDto, ItemDto, OfferDto, ConversationDto } from '@valora/contracts';
import { useState, useRef } from 'react';
import { ImageOff, ArrowUpRight, MessageCircle, Check, X, ArrowLeft, PackageCheck, MapPin } from 'lucide-react';
import { useSession } from '@/lib/session';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiEnvelope, ApiClientError, api } from '@/lib/api';
import { Notice, Button, Field, Input } from "../../components/ui/primitives";
import Link from 'next/link';
import { MarketGrid } from './grid';
import { listingMoney, listingConditionLabel } from './labels';
import { ListingFavorite } from '../favorites/button';

type ActiveListing = Extract<PublicListingDto, { status: 'ACTIVE' }>;

const typeLabels: Record<ActiveListing['type'], string> = { RESELL: 'Jual kembali', EXCHANGE: 'Tukar barang', DONATE: 'Donasi' };

const actionLabels: Record<ActiveListing['type'], string> = { RESELL: 'Ajukan penawaran', EXCHANGE: 'Ajukan tukar', DONATE: 'Minat donasi' };

function DetailPhoto({ url, title, number, thumbnail = false }: { url?: string; title: string; number: number; thumbnail?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <div className="detail-photo-fallback" role="img" aria-label={`Foto ${number} ${title} belum tersedia`}><ImageOff size={thumbnail ? 20 : 32} strokeWidth={1.4} aria-hidden="true" />{!thumbnail && <span>Foto belum tersedia</span>}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={thumbnail ? '' : `Foto ${number} ${title}`} width={800} height={600} loading={thumbnail ? 'lazy' : 'eager'} decoding="async" onError={() => setFailed(true)} />;
}

function ListingGallery({ listing }: { listing: ActiveListing }) {
  const photos = [...listing.revision.media].sort((a, b) => a.orderIndex - b.orderIndex);
  const [selected, setSelected] = useState(0);
  const photo = photos[selected] ?? photos[0];
  return <section className="detail-gallery" aria-label="Foto barang">
    <div className="detail-main-photo"><DetailPhoto key={photo?.id ?? 'empty'} url={photo?.url} title={listing.revision.title} number={selected + 1} /></div>
    {photos.length > 1 && <><div className="detail-thumbnails" role="group" aria-label="Pilih foto barang">{photos.map((entry, index) => <button type="button" key={entry.id} aria-label={`Lihat foto ${index + 1}`} aria-pressed={selected === index} onClick={() => setSelected(index)}><DetailPhoto url={entry.url} title={listing.revision.title} number={index + 1} thumbnail /></button>)}</div><p className="detail-photo-counter" role="status">Foto {selected + 1} dari {photos.length}</p></>}
  </section>;
}

function ListingActions({ listing, reload }: { listing: ActiveListing; reload: () => void }) {
  const session = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(listing.revision.askingPriceIdr?.toString() ?? '');
  const [exchangeItemId, setExchangeItemId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'offer' | 'chat' | null>(null);
  const pending = useRef(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const firstField = useRef<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [success, setSuccess] = useState(false);
  const loginHref = '/masuk?next=' + encodeURIComponent(`/market/${listing.id}`);
  const verificationHref = '/verifikasi-email?email=' + encodeURIComponent(session.session?.user?.email ?? '');
  const authenticated = session.state === 'AUTHENTICATED';
  const verified = authenticated && Boolean(session.session?.user?.emailVerifiedAt);
  const items = useQuery({ queryKey: ['items', 'exchange'], queryFn: () => apiEnvelope<ItemDto[]>('/items?limit=50'), enabled: open && verified && listing.type === 'EXCHANGE', retry: false });

  function showForm() {
    setOpen(true);
    requestAnimationFrame(() => { if (firstField.current?.disabled) document.getElementById('detail-offer-message')?.focus(); else firstField.current?.focus(); });
  }
  function handleError(cause: unknown) {
    if (cause instanceof ApiClientError && cause.status === 401) { router.push(loginHref); return; }
    setError(cause instanceof Error ? cause.message : 'Permintaan belum berhasil. Coba lagi.');
    setErrorCode(cause instanceof ApiClientError ? cause.code : '');
  }
  async function sendOffer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || success || !verified) return;
    if (listing.type === 'EXCHANGE' && !exchangeItemId) return;
    if (listing.type === 'RESELL' && (!Number.isSafeInteger(Number(price)) || Number(price) < 1 || Number(price) > 1_000_000_000_000)) { setError('Isi nominal rupiah yang valid, minimal Rp 1.'); return; }
    pending.current = true; setBusy('offer'); setError(''); setErrorCode('');
    const payload = { listingRevisionId: listing.revision.id, expectedListingVersion: listing.version, ...(listing.type === 'RESELL' ? { priceIdr: Number(price) } : listing.type === 'EXCHANGE' ? { exchangeItemId } : {}), ...(message.trim() ? { message: message.trim() } : {}) };
    const signature = JSON.stringify(payload);
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try {
      await api<OfferDto>(`/listings/${listing.id}/offers`, { method: 'POST', body: { ...payload, clientRequestId: request.current.id } });
      setSuccess(true); setOpen(false); request.current = null;
    } catch (cause) { handleError(cause); }
    finally { pending.current = false; setBusy(null); }
  }
  async function openChat() {
    if (pending.current || !verified) return;
    pending.current = true; setBusy('chat'); setError(''); setErrorCode('');
    try { const conversation = await api<ConversationDto>(`/listings/${listing.id}/conversations`, { method: 'POST' }); router.push(`/app/pesan/${conversation.id}`); }
    catch (cause) { handleError(cause); }
    finally { pending.current = false; setBusy(null); }
  }
  const feedback = error && <Notice kind="error">{error}{errorCode === 'STATE_CONFLICT' && <Button type="button" variant="quiet" onClick={reload}>Muat ulang detail</Button>}{errorCode === 'EMAIL_UNVERIFIED' && <Link href={verificationHref}>Verifikasi email</Link>}</Notice>;

  if (session.state === 'CHECKING' || session.state === 'LOGOUT_PENDING') return <div className="detail-session-status" role="status">Memeriksa sesi…</div>;
  if (session.state === 'UNAVAILABLE') return <Notice>Sesi belum dapat diperiksa. <button type="button" className="link-button" onClick={() => session.refresh()}>Coba lagi</button></Notice>;
  if (!authenticated) return <div className="detail-actions"><p>Masuk untuk mengajukan penawaran atau bertanya kepada pemilik.</p><div className="detail-action-buttons"><Link className="button button-primary" href={loginHref}>{actionLabels[listing.type]}<ArrowUpRight size={18} aria-hidden="true" /></Link><Link className="button button-secondary" href={loginHref}><MessageCircle size={18} aria-hidden="true" />Tanya pemilik</Link></div></div>;
  if (!verified) return <div className="detail-actions"><Notice>Verifikasi email untuk mengirim penawaran dan memulai percakapan.</Notice><Link className="button button-primary" href={verificationHref}>Verifikasi email<ArrowUpRight size={18} aria-hidden="true" /></Link></div>;

  return <div className="detail-actions">
    {success && <div className="detail-offer-success" role="status"><Check size={20} aria-hidden="true" /><div><strong>Penawaran terkirim.</strong><p>Pantau tanggapan pemilik melalui halaman Penawaran.</p><Link href="/app/penawaran">Lihat penawaran saya<ArrowUpRight size={15} aria-hidden="true" /></Link></div></div>}
    <div className="detail-action-buttons"><button ref={toggle} className="button button-primary" type="button" disabled={Boolean(busy) || success} aria-expanded={open} aria-controls="detail-offer-form" onClick={showForm}>{actionLabels[listing.type]}<ArrowUpRight size={18} aria-hidden="true" /></button><Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={openChat}><MessageCircle size={18} aria-hidden="true" />{busy === 'chat' ? 'Membuka chat…' : 'Tanya pemilik'}</Button></div>
    {!open && feedback}
    {open && <form id="detail-offer-form" className="detail-offer-form" onSubmit={sendOffer} aria-busy={busy === 'offer'}>
      <div className="detail-form-heading"><h2>{actionLabels[listing.type]}</h2><button className="detail-form-close" type="button" aria-label="Tutup formulir penawaran" disabled={Boolean(busy)} onClick={() => { setOpen(false); requestAnimationFrame(() => toggle.current?.focus()); }}><X size={18} aria-hidden="true" /></button></div>
      <fieldset disabled={Boolean(busy)}>
        {listing.type === 'RESELL' && <Field label="Nominal penawaran" htmlFor="detail-offer-price" hint="Nominal usulan dalam rupiah, bukan pembayaran."><Input ref={element => { firstField.current = element; }} id="detail-offer-price" type="number" inputMode="numeric" min="1" max="1000000000000" step="1" required value={price} aria-describedby="detail-offer-price-hint" onChange={event => setPrice(event.target.value)} /></Field>}
        {listing.type === 'EXCHANGE' && <Field label="Barang yang ditawarkan" htmlFor="detail-exchange-item" hint="Kelayakan barang penukar diperiksa berdasarkan penilaian terkini."><Select ref={element => { firstField.current = element; }} className="select" id="detail-exchange-item" required value={exchangeItemId} disabled={items.isPending || items.isError || !items.data?.data.length} aria-describedby="detail-exchange-item-hint" onChange={event => setExchangeItemId(event.target.value)}><option value="">Pilih barang milikmu</option>{items.data?.data.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</Select>
          {items.isPending ? <p className="detail-inline-status" role="status">Memuat barangmu…</p> : items.isError ? <Notice kind="error">Barangmu gagal dimuat. <button type="button" className="link-button" onClick={() => items.refetch()}>Coba lagi</button></Notice> : !items.data?.data.length ? <p className="detail-inline-status">Belum ada barang untuk dipilih. <Link href="/app/barang/baru">Catat barangmu dahulu</Link>.</p> : null}
        </Field>}
        <Field label="Pesan untuk pemilik (opsional)" htmlFor="detail-offer-message"><textarea ref={listing.type === 'DONATE' ? element => { firstField.current = element; } : undefined} id="detail-offer-message" className="textarea" maxLength={500} value={message} placeholder="Tulis pertanyaan atau konteks singkat." onChange={event => setMessage(event.target.value)} /></Field>
        {feedback}
        <Button type="submit" disabled={Boolean(busy) || listing.type === 'EXCHANGE' && (!exchangeItemId || items.isPending || items.isError)}>{busy === 'offer' ? 'Mengirim…' : 'Kirim penawaran'}<ArrowUpRight size={18} aria-hidden="true" /></Button>
      </fieldset>
    </form>}
    <p className="detail-action-note">Chat untuk bertanya. Kesepakatan dicatat melalui penawaran.</p>
  </div>;
}

function RelatedListings({ listing }: { listing: ActiveListing }) {
  const category = listing.revision.categoryCode;
  const query = new URLSearchParams({ category, limit: '5', sort: 'newest' });
  const related = useQuery({ queryKey: ['market', 'related', category], queryFn: () => apiEnvelope<PublicListingDto[]>(`/market?${query}`), staleTime: 60_000 });
  const rows = related.data?.data.filter((row): row is ActiveListing => row.status === 'ACTIVE' && row.id !== listing.id).slice(0, 4) ?? [];
  if (!related.isPending && !related.isError && !rows.length) return null;
  return <section className="detail-related" aria-labelledby="detail-related-title"><div className="detail-related-heading"><h2 id="detail-related-title">Barang lain yang mungkin cocok.</h2><Link href={`/market?category=${encodeURIComponent(category)}`}>Lihat kategori<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
    {related.isPending ? <p role="status" className="detail-inline-status">Memuat barang terkait…</p> : related.isError ? <Notice>Barang terkait belum dapat dimuat. <button type="button" className="link-button" onClick={() => related.refetch()}>Coba lagi</button></Notice> : <MarketGrid listings={rows} />}
  </section>;
}

export function PublicListingDetail({ listingId }: { listingId: string }) {
  const listing = useQuery({ queryKey: ['market', listingId], queryFn: () => api<PublicListingDto>(`/market/${listingId}`), retry: false });
  const back = <Link href="/market" className="detail-back"><ArrowLeft size={17} aria-hidden="true" />Kembali ke Market</Link>;
  if (listing.isPending) return <main id="main-content" className="container market-detail">{back}<p className="detail-inline-status" role="status">Memuat detail barang…</p><div className="detail-top detail-loading" aria-hidden="true"><div className="detail-loading-photo" /><div><span /><span /><span /><span /></div></div></main>;
  if (listing.isError && !listing.data) {
    const unavailable = listing.error instanceof ApiClientError && [400, 404, 410].includes(listing.error.status);
    return <main id="main-content" className="container market-detail">{back}<section className="detail-unavailable"><PackageCheck size={36} strokeWidth={1.4} aria-hidden="true" /><h1>{unavailable ? 'Barang tidak tersedia.' : 'Detail barang belum dapat dimuat.'}</h1><p>{unavailable ? 'Barang ini mungkin sudah ditutup atau tidak lagi ditawarkan. Temukan barang lain di Market.' : 'Terjadi gangguan saat memuat informasi barang. Coba kembali dalam beberapa saat.'}</p>{!unavailable && <Button onClick={() => listing.refetch()}>Coba lagi</Button>}<Link href="/market" className="button button-secondary">Jelajahi Market<ArrowUpRight size={18} aria-hidden="true" /></Link></section></main>;
  }
  if (!listing.data) return null;
  if (listing.data.status === 'RESERVED') return <main id="main-content" className="container market-detail">{back}<section className="detail-unavailable"><PackageCheck size={36} strokeWidth={1.4} aria-hidden="true" /><h1>Barang sedang dalam kesepakatan.</h1><p>Barang ini sedang diproses bersama calon pemilik berikutnya. Penawaran baru ditutup sementara.</p><ListingFavorite listingId={listingId} title="Barang ini" allowSave={false} /><Link href="/market" className="button button-primary">Jelajahi barang lain<ArrowUpRight size={18} aria-hidden="true" /></Link></section></main>;
  const row = listing.data;
  const revision = row.revision;
  const price = row.type === 'RESELL' ? revision.askingPriceIdr === null ? 'Harga belum tersedia' : listingMoney(revision.askingPriceIdr) : row.type === 'DONATE' ? 'Tanpa biaya' : 'Tukar barang';
  return <main id="main-content" className="container market-detail">{back}
    {listing.isError && <Notice kind="error">Detail terbaru gagal dimuat. <button type="button" className="link-button" onClick={() => listing.refetch()}>Coba lagi</button></Notice>}
    <div className="detail-top"><ListingGallery key={revision.id} listing={row} /><section className="detail-summary" aria-labelledby="detail-title"><div className="detail-tags"><span>{typeLabels[row.type]}</span><Link href={`/market?category=${encodeURIComponent(revision.categoryCode)}`}>{revision.categoryName}</Link></div><h1 id="detail-title">{revision.title}</h1><p className="detail-price">{price}</p><ListingFavorite listingId={row.id} title={revision.title} /><p className="detail-location"><MapPin size={16} aria-hidden="true" />{revision.city.name}, {revision.city.provinceName}</p><div className="detail-condition"><span>{listingConditionLabel(revision.condition)}</span><span>Valora Score <strong>{revision.score ?? 'belum tersedia'}</strong></span></div><p className="detail-score-note">Kondisi dan Score berdasarkan informasi yang dilaporkan pemilik.</p><ListingActions key={`${row.id}:${row.version}:${revision.id}`} listing={row} reload={() => { void listing.refetch(); }} /></section></div>
    <div className="detail-content"><div className="detail-information"><section><h2>Tentang barang ini.</h2><p>{revision.description}</p></section><section><h2>Kondisi yang perlu kamu tahu.</h2><p>{revision.conditionDisclosure}</p></section>{row.type === 'EXCHANGE' && <section><h2>Barang yang ingin ditukar.</h2><p>{revision.exchangePreference ?? 'Tanyakan preferensi pertukaran kepada pemilik.'}</p></section>}{row.type === 'DONATE' && revision.recipientNote && <section><h2>Catatan untuk calon penerima.</h2><p>{revision.recipientNote}</p></section>}</div>
      <aside className="detail-owner" aria-labelledby="detail-owner-title"><h2 id="detail-owner-title">Dari pemilik barang.</h2><MarketOwnerProfile id={row.owner.id} displayName={row.owner.displayName} /><p className="detail-owner-city">{row.owner.city.name}, {row.owner.city.provinceName}</p><div className="detail-handover"><h3>Serah terima</h3><p>{revision.handoverMethods.map(value => value === 'MEETUP' ? 'Bertemu langsung' : 'Pengiriman').join(' · ')}</p></div><p className="detail-handover-note">Pembayaran dan serah terima diatur bersama pemilik setelah kesepakatan dicatat.</p><Link className="button button-secondary" href={`/passport/${revision.itemId}`}>Lihat Passport barang<ArrowUpRight size={17} aria-hidden="true" /></Link></aside>
    </div><RelatedListings listing={row} />
  </main>;
}
