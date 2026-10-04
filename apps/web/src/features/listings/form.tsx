'use client';

import { Select } from '@/components/ui/select';

import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/session';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiEnvelope, api } from '@/lib/api';
import type { ItemDto, AssessmentDto, ListingSaveInput, ListingDto } from '@valora/contracts';
import { useRef, useState } from 'react';
import { Notice, Field, Button, Input } from "../../components/ui/primitives";
import { AccountError } from '../account/error';
import Link from 'next/link';
import { CityPicker } from '../../components/ui/city-picker';

export function ListingCreateForm() {
  const router = useRouter();
  const me = useMe();
  const items = useInfiniteQuery({ queryKey: ['items', 'listing-create'], initialPageParam: null as string | null, queryFn: ({ pageParam }) => apiEnvelope<ItemDto[]>('/items?limit=50' + (pageParam ? '&cursor=' + encodeURIComponent(pageParam) : '')), getNextPageParam: (page) => page.meta?.nextCursor ?? undefined });
  const allItems = items.data?.pages.flatMap((page) => page.data) ?? []; const creating = useRef(false);
  const [itemId, setItemId] = useState('');
  const [type, setType] = useState<'RESELL' | 'EXCHANGE' | 'DONATE'>('RESELL');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [disclosure, setDisclosure] = useState('');
  const [price, setPrice] = useState(''); const [exchangePreference, setExchangePreference] = useState(''); const [recipientNote, setRecipientNote] = useState('');
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [handover, setHandover] = useState<string[]>(['MEETUP']); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const assessmentsQuery = useQuery({ queryKey: ['assessments', itemId], queryFn: () => api<AssessmentDto[]>(`/items/${itemId}/assessments`), enabled: Boolean(itemId) });
  const assessments = assessmentsQuery.data?.filter((entry) => entry.isCurrent) ?? [];
  const assessmentId = assessments.some((entry) => entry.id === selectedAssessmentId) ? selectedAssessmentId : assessments[0]?.id ?? '';
  const cityId = selectedCityId ?? me.data?.city.id ?? '';
  const selectedItem = allItems.find((entry) => entry.id === itemId);
  const currentAssessment = assessments.find((entry) => entry.id === assessmentId);
  const eligible = currentAssessment?.recommendations.filter((entry) => entry.status === 'ELIGIBLE').map((entry) => entry.action) ?? [];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (creating.current) return; setError('');
    if (!selectedItem || !currentAssessment || !cityId || !handover.length) { setError('Pilih barang, penilaian terkini, kota, dan metode serah terima.'); return; }
    if (!eligible.includes(type)) { setError('Hasil Assessment belum mengizinkan jenis Listing ini. Lengkapi atau perbarui Assessment.'); return; }
    const common = { assessmentId, expectedItemVersion: selectedItem.version, type, title, description, mediaIds: selectedItem.media.map((media) => media.id), cityId, conditionDisclosure: disclosure, handoverMethods: handover as ('MEETUP' | 'DELIVERY')[] };
    const body: ListingSaveInput = type === 'RESELL' ? { ...common, type, askingPriceIdr: Number(price) } : type === 'EXCHANGE' ? { ...common, type, exchangePreference } : { ...common, type, recipientNote: recipientNote || null };
    creating.current = true; setSaving(true);
    try {
      const draft = await api<ListingDto>(`/items/${itemId}/listings`, { method: 'POST', body });
      try { await api<ListingDto>(`/listings/${draft.id}/submit`, { method: 'POST', body: { expectedVersion: draft.version } }); router.push(`/app/listings/${draft.id}`); }
      catch (cause) { setError(cause instanceof Error ? `Draft tersimpan. Pengajuan belum terkirim: ${cause.message}` : 'Draft tersimpan, tetapi pengajuan belum terkirim.'); router.push(`/app/listings/${draft.id}`); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Listing belum tersimpan.'); }
    finally { creating.current = false; setSaving(false); }
  }
  if (!me.data?.emailVerifiedAt && !me.isPending) return <><div className="app-heading"><div><span className="eyebrow">AKUN / LISTING</span><h1>Verifikasi email</h1></div></div><Notice>Verifikasi email terlebih dahulu sebelum memakai Market.</Notice></>;
  return <><div className="app-heading"><div><span className="eyebrow">AKUN / LISTING BARU</span><h1>Ajukan barangmu.</h1><p>Listing akan diperiksa sebelum muncul di Market.</p></div></div><form className="listing-create-form" onSubmit={submit} aria-busy={saving}>
    <fieldset className="account-form-fields" disabled={saving}><section className="listing-form-section"><h2>Pilih barang dan jalur</h2>
      <Field label="Barang milikmu" htmlFor="listing-item"><Select className="select" id="listing-item" required value={itemId} onChange={(e) => { const next = allItems.find((entry) => entry.id === e.target.value); setItemId(e.target.value); setSelectedAssessmentId(''); if (next) { setTitle(next.title); setDescription(next.description); setDisclosure(next.conditionSummary ?? ''); } }}><option value="">Pilih barang</option>{allItems.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.media.length} foto</option>)}</Select></Field>
      {items.isError && <AccountError retry={() => items.refetch()}>Daftar barang gagal dimuat.</AccountError>}{items.hasNextPage && <Button type="button" variant="quiet" disabled={items.isFetchingNextPage} onClick={() => items.fetchNextPage()}>{items.isFetchingNextPage ? 'Memuat barang…' : items.isFetchNextPageError ? 'Coba muat barang lagi' : 'Muat pilihan barang berikutnya'}</Button>}
      {assessmentsQuery.isPending && itemId && <p role="status">Memuat penilaian…</p>}{assessmentsQuery.isError && <AccountError retry={() => assessmentsQuery.refetch()}>Penilaian gagal dimuat.</AccountError>}{selectedItem && !assessmentsQuery.isPending && !assessmentsQuery.isError && !currentAssessment && <Notice>Barang belum memiliki penilaian terkini. <Link href={`/app/barang/${itemId}/penilaian/baru`}>Buat penilaian</Link></Notice>}
      <Field label="Jenis Listing" htmlFor="listing-type"><Select className="select" id="listing-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="RESELL">Resell</option><option value="EXCHANGE">Tukar barang</option><option value="DONATE">Donasi</option></Select></Field>
      {currentAssessment && <p className="listing-gate-note">Assessment {currentAssessment.status}: {eligible.length ? `jalur tersedia — ${eligible.join(', ')}` : 'belum ada jalur yang memenuhi syarat'}.</p>}
      {selectedItem?.reservedByTransactionId && <Notice>Barang sedang dalam transaksi. Tunggu sampai reservasi berakhir.</Notice>}{selectedItem && !selectedItem.media.length && <Notice kind="error">Barang perlu memiliki foto sebelum dapat diajukan.</Notice>}
    </section>
    <section className="listing-form-section"><h2>Jelaskan dengan jujur.</h2>
      <Field label="Judul Listing" htmlFor="listing-title"><Input id="listing-title" required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Deskripsi" htmlFor="listing-description"><textarea className="textarea" id="listing-description" required minLength={10} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="Kondisi yang perlu diketahui" htmlFor="listing-disclosure" hint="Sebutkan bekas pakai, cacat, fungsi yang bermasalah, atau keterbatasan yang belum tercakup di Assessment."><textarea className="textarea" id="listing-disclosure" required minLength={3} maxLength={1500} value={disclosure} onChange={(e) => setDisclosure(e.target.value)} placeholder="Contoh: ada goresan kecil di sisi kanan." /></Field>
      {type === 'RESELL' && <Field label="Harga yang diminta (rupiah)" htmlFor="listing-price"><Input id="listing-price" type="number" min="1" max="1000000000000" required value={price} onChange={(e) => setPrice(e.target.value)} /></Field>}
      {type === 'EXCHANGE' && <Field label="Preferensi barang pengganti" htmlFor="listing-exchange"><textarea className="textarea" id="listing-exchange" required minLength={3} maxLength={1000} value={exchangePreference} onChange={(e) => setExchangePreference(e.target.value)} placeholder="Jenis barang yang kamu cari." /></Field>}
      {type === 'DONATE' && <Field label="Catatan untuk penerima (opsional)" htmlFor="listing-donate"><textarea className="textarea" id="listing-donate" maxLength={500} value={recipientNote} onChange={(e) => setRecipientNote(e.target.value)} /></Field>}
    </section>
    <section className="listing-form-section"><h2>Pilih area dan cara serah terima.</h2>
      <CityPicker required value={cityId} initial={me.data?.city} onChange={(city) => setSelectedCityId(city.id)} />
      <fieldset className="handover-choice"><legend>Metode serah terima</legend>{[['MEETUP', 'Bertemu langsung'], ['DELIVERY', 'Pengiriman']].map(([value, label]) => <label key={value}><input type="checkbox" checked={handover.includes(value)} onChange={(e) => setHandover((old) => e.target.checked ? [...old, value] : old.filter((entry) => entry !== value))} />{label}</label>)}</fieldset>
    </section>
    </fieldset>{error && <Notice kind="error">{error}</Notice>}
    <div className="listing-form-footer"><p>Foto mengikuti galeri Item. Setelah dikirim, tim Valora meninjau isi Listing sebelum diterbitkan.</p><Button type="submit" disabled={saving || !selectedItem || !currentAssessment || !eligible.includes(type) || Boolean(selectedItem?.reservedByTransactionId)}>{saving ? 'Menyimpan…' : 'Simpan dan ajukan review'}</Button></div>
  </form></>;
}
