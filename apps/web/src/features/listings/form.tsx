'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AssessmentDto,
  ItemDto,
  ListingDto,
  ListingSaveInput,
} from '@valora/contracts';

import { api, apiEnvelope } from '@/lib/api';
import { useMe } from '@/lib/session';
import { CityPicker } from '@/components/ui/city-picker';
import { Button, Field, Input, Notice } from '@/components/ui/primitives';
import { Select } from '@/components/ui/select';
import { PrivatePhoto } from '../items/photo';

type ListingType = 'RESELL' | 'DONATE' | 'EXCHANGE';
type HandoverMethod = 'MEETUP' | 'DELIVERY';

const labels: Record<ListingType, string> = {
  RESELL: 'Jual',
  DONATE: 'Donasikan',
  EXCHANGE: 'Tukar',
};

interface FormProps {
  initialItemId?: string;
  initialType?: ListingType;
}

export function ListingCreateForm({
  initialItemId = '',
  initialType = 'RESELL',
}: FormProps) {
  const [itemId, setItemId] = useState(initialItemId);
  const [type, setType] = useState<ListingType>(initialType);
  const me = useMe();

  // Formulir yang dibuka dari kartu langsung mengambil barang tersebut.
  // Ini juga bekerja untuk barang yang berada di halaman kedua dan seterusnya.
  const selected = useQuery({
    queryKey: ['item', itemId],
    queryFn: () => api<ItemDto>(`/items/${encodeURIComponent(itemId)}`),
    enabled: Boolean(itemId),
  });

  // Pemilih barang tetap tersedia bagi pengguna yang membuka formulir
  // melalui menu pengajuan tanpa melalui kartu barang.
  const choices = useInfiniteQuery({
    queryKey: ['items', 'listing-create'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (pageParam) params.set('cursor', pageParam);
      return apiEnvelope<ItemDto[]>(`/items?${params}`);
    },
    getNextPageParam: page => page.meta?.nextCursor ?? undefined,
    enabled: !itemId,
  });

  if (me.isPending) return <p role="status">Memuat akun…</p>;

  if (me.isError || !me.data) {
    return (
      <Notice kind="error">
        Akun belum berhasil dimuat.{' '}
        <Button variant="quiet" onClick={() => void me.refetch()}>
          Coba lagi
        </Button>
      </Notice>
    );
  }

  if (!me.data.emailVerifiedAt) {
    const href =
      '/verifikasi-email?email=' + encodeURIComponent(me.data.email);

    return (
      <Notice>
        Verifikasi email untuk mengajukan barang ke Market.{' '}
        <Link href={href}>Verifikasi email</Link>
      </Notice>
    );
  }

  const options = choices.data?.pages.flatMap(page => page.data) ?? [];

  return (
    <>
      <div className="app-heading">
        <div>
          <Link href="/app/barang">← Barang saya</Link>
          <h1>{labels[type]} barang</h1>
          <p>
            {type === 'DONATE'
              ? 'Tawarkan barang secara gratis kepada calon penerima.'
              : type === 'EXCHANGE'
                ? 'Jelaskan barang pengganti yang kamu cari.'
                : 'Tentukan harga dan cara menyerahkan barang kepada pembeli.'}
          </p>
        </div>
      </div>

      {!itemId ? (
        <section className="listing-form-section">
          <h2>Pilih barang milikmu</h2>

          {choices.isPending ? (
            <p role="status">Memuat barang…</p>
          ) : choices.isError && !options.length ? (
            <Notice kind="error">
              Daftar barang gagal dimuat.{' '}
              <Button variant="quiet" onClick={() => void choices.refetch()}>
                Coba lagi
              </Button>
            </Notice>
          ) : options.length ? (
            <Field label="Barang" htmlFor="choose-item">
              <Select
                id="choose-item"
                className="select"
                value=""
                onChange={event => setItemId(event.target.value)}
              >
                <option value="">Pilih barang</option>
                {options.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <p>
              Belum ada barang di akunmu.{' '}
              <Link href="/app/barang/baru">Tambah barang pertama</Link>
            </p>
          )}

          {choices.hasNextPage && (
            <Button
              type="button"
              variant="quiet"
              disabled={choices.isFetchingNextPage}
              onClick={() => void choices.fetchNextPage()}
            >
              {choices.isFetchingNextPage
                ? 'Memuat…'
                : choices.isFetchNextPageError
                  ? 'Coba muat lagi'
                  : 'Muat barang lainnya'}
            </Button>
          )}
        </section>
      ) : selected.isPending ? (
        <p role="status">Memuat barang pilihanmu…</p>
      ) : selected.isError || !selected.data ? (
        <Notice kind="error">
          Barang pilihanmu belum bisa dibuka.{' '}
          <Button variant="quiet" onClick={() => void selected.refetch()}>
            Coba lagi
          </Button>{' '}
          <Link href="/app/barang">Pilih barang lain</Link>
        </Notice>
      ) : (
        <OfferForm
          key={selected.data.id}
          item={selected.data}
          type={type}
          setType={setType}
          initialCity={me.data.city}
          refreshItem={() => void selected.refetch()}
        />
      )}
    </>
  );
}

type City = NonNullable<ReturnType<typeof useMe>['data']>['city'];

interface OfferFormProps {
  item: ItemDto;
  type: ListingType;
  setType: (value: ListingType) => void;
  initialCity: City;
  refreshItem: () => void;
  listing?: ListingDto;
}

export function OfferForm({
  item,
  type,
  setType,
  initialCity,
  refreshItem,
  listing,
}: OfferFormProps) {
  const router = useRouter();
  const cache = useQueryClient(); const revision = listing?.currentRevision;
  const [editVersion] = useState(listing?.version);
  const locked = useRef(false);

  const [title, setTitle] = useState(revision?.title ?? item.title);
  const [description, setDescription] = useState(revision?.description ?? item.description);
  const [condition, setCondition] = useState(revision?.conditionDisclosure ?? item.conditionSummary ?? '');
  const [price, setPrice] = useState(revision?.askingPriceIdr?.toString() ?? '');
  const [recipientNote, setRecipientNote] = useState(revision?.recipientNote ?? '');
  const [exchangePreference, setExchangePreference] = useState(revision?.exchangePreference ?? '');
  const [cityId, setCityId] = useState(revision?.city.id ?? initialCity.id);
  const [methods, setMethods] = useState<HandoverMethod[]>(revision?.handoverMethods ?? ['MEETUP']);
  const [mediaIds, setMediaIds] = useState<string[]>(revision ? revision.media.filter(photo => item.media.some(current => current.id === photo.id)).map(photo => photo.id) : item.media.map(photo => photo.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedDraft, setSavedDraft] = useState('');

  const assessments = useQuery({
    queryKey: ['assessments', item.id],
    queryFn: () => api<AssessmentDto[]>(`/items/${item.id}/assessments`),
  });

  const current = assessments.data?.filter(entry => entry.isCurrent) ?? [];

  const assessment = current.find(entry =>
    entry.recommendations.some(
      recommendation =>
        recommendation.action === type &&
        recommendation.status === 'ELIGIBLE',
    ),
  );

  const canOffer =
    Boolean(assessment) &&
    item.media.length > 0 &&
    !item.reservedByTransactionId;

  const itemUrl = `/app/barang/${item.id}`;

  function toggleMethod(method: HandoverMethod) {
    setMethods(previous =>
      previous.includes(method)
        ? previous.filter(entry => entry !== method)
        : [...previous, method],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || savedDraft) return;

    setError('');

    if (!canOffer || !assessment) {
      setError('Lengkapi kesiapan barang sebelum mengajukan.');
      return;
    }

    if (!cityId || methods.length === 0 || mediaIds.length === 0) {
      setError('Pilih kota dari daftar, minimal satu foto, dan satu cara serah terima.');
      return;
    }

    const common = {
      assessmentId: assessment.id,
      expectedItemVersion: item.version,
      title: title.trim(),
      description: description.trim(),
      conditionDisclosure: condition.trim(),
      mediaIds,
      cityId,
      handoverMethods: methods,
    };

    let body: ListingSaveInput;

    if (type === 'RESELL') {
      body = { ...common, type, askingPriceIdr: Number(price) };
    } else if (type === 'DONATE') {
      body = { ...common, type, recipientNote: recipientNote.trim() || null };
    } else {
      body = { ...common, type, exchangePreference: exchangePreference.trim() };
    }

    locked.current = true;
    setSaving(true);

    try {
      if (listing) {
        await api<ListingDto>(`/listings/${listing.id}`, { method: 'PATCH', body: { ...body, expectedVersion: editVersion, copyOnlyCorrection: false } });
        await cache.invalidateQueries({ queryKey: ['listings'] });
        router.push(`/app/listings/${listing.id}`); return;
      }
      const draft = await api<ListingDto>(`/items/${item.id}/listings`, {
        method: 'POST',
        body,
      });

      // Simpan ID segera agar pengajuan yang gagal tidak membuat draf kedua.
      setSavedDraft(draft.id);

      await api<ListingDto>(`/listings/${draft.id}/submit`, {
        method: 'POST',
        body: { expectedVersion: draft.version },
      });

      router.push(`/app/listings/${draft.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pengajuan gagal.');
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }

  if (savedDraft && !saving) {
    return (
      <section className="listing-form-section">
        <h2>{error ? 'Draf sudah tersimpan' : 'Pengajuan sudah dikirim'}</h2>
        {error && (
          <Notice kind="error">
            Pengajuan belum terkonfirmasi. {error}
          </Notice>
        )}
        <p>Buka detail untuk melihat status atau melanjutkan pengajuan.</p>
        <Link className="button button-primary" href={`/app/listings/${savedDraft}`}>
          Buka pengajuan saya
        </Link>
      </section>
    );
  }

  return (
    <form className="listing-create-form" onSubmit={submit} aria-busy={saving}>
      <fieldset className="account-form-fields" disabled={saving}>
        <section className="listing-form-section">
          <h2>{item.title}</h2>
          <p>
            {item.media.length} foto{!listing && ' · '}
            {!listing && <Link href="/app/barang">Pilih barang lain</Link>}
          </p>

          <Field label={listing ? 'Jenis Listing' : 'Apa yang ingin kamu lakukan?'} htmlFor="offer-type">
            <Select
              id="offer-type"
              className="select"
              value={type}
              disabled={Boolean(listing)}
              onChange={event => setType(event.target.value as ListingType)}
            >
              <option value="RESELL">Jual barang ini</option>
              <option value="DONATE">Donasikan barang ini</option>
              <option value="EXCHANGE">Tukar barang ini</option>
            </Select>
          </Field>

          {item.reservedByTransactionId ? (
            <Notice>
              Barang ini sedang dalam transaksi.{' '}
              <Link href="/app/transaksi">Lihat transaksi</Link>
            </Notice>
          ) : (
            <>
              {item.media.length === 0 && (
                <Notice>
                  Tambahkan foto agar calon pembeli atau penerima bisa melihat
                  barangnya.{' '}
                  <Link href={`${itemUrl}/edit`} target="_blank" rel="noreferrer">
                    Tambah foto di tab baru
                  </Link>
                </Notice>
              )}

              {assessments.isPending ? (
                <p role="status">Memeriksa penilaian kondisi…</p>
              ) : assessments.isError ? (
                <Notice kind="error">
                  Penilaian belum bisa dimuat.{' '}
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => void assessments.refetch()}
                  >
                    Coba lagi
                  </Button>
                </Notice>
              ) : !assessment ? (
                <Notice>
                  {current.length === 0
                    ? 'Nilai kondisi barang dulu agar Valora dapat menentukan jalur yang tersedia.'
                    : `Penilaian saat ini belum mengizinkan pilihan ${labels[type].toLowerCase()}. Periksa hasilnya atau pilih jalur lain.`}
                  {' '}
                  <Link
                    href={current.length ? `${itemUrl}/penilaian` : `${itemUrl}/penilaian/baru`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {current.length ? 'Lihat penilaian di tab baru' : 'Nilai kondisi di tab baru'}
                  </Link>
                </Notice>
              ) : null}

              {(!item.media.length || !assessment) && !assessments.isPending && (
                <Button
                  type="button"
                  variant="quiet"
                  disabled={assessments.isFetching}
                  onClick={() => {
                    refreshItem();
                    void assessments.refetch();
                  }}
                >
                  Sudah dilengkapi? Periksa kembali
                </Button>
              )}
            </>
          )}
        </section>

        {canOffer && (
          <>
            <section className="listing-form-section">
              <h2>{type === 'DONATE' ? 'Detail donasi' : 'Detail penawaran'}</h2>

              <Field label="Judul yang tampil di Market" htmlFor="offer-title">
                <Input
                  id="offer-title"
                  value={title}
                  required
                  minLength={3}
                  maxLength={120}
                  onChange={event => setTitle(event.target.value)}
                />
              </Field>

              <Field label="Deskripsi barang" htmlFor="offer-description">
                <textarea
                  className="textarea"
                  id="offer-description"
                  required
                  minLength={10}
                  maxLength={3000}
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                />
              </Field>

              <Field
                label="Kondisi yang perlu diketahui"
                htmlFor="offer-condition"
                hint="Contoh: kursi masih kokoh, ada goresan pada sandaran."
              >
                <textarea
                  className="textarea"
                  id="offer-condition"
                  required
                  minLength={3}
                  maxLength={1500}
                  value={condition}
                  onChange={event => setCondition(event.target.value)}
                />
              </Field>

              {type === 'RESELL' && (
                <Field label="Harga jual (Rp)" htmlFor="offer-price">
                  <Input
                    id="offer-price"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1_000_000_000_000}
                    step={1}
                    placeholder="Contoh: 75000"
                    value={price}
                    required
                    onChange={event => setPrice(event.target.value)}
                  />
                </Field>
              )}

              {type === 'DONATE' && (
                <Field
                  label="Pesan untuk penerima (opsional)"
                  htmlFor="offer-recipient"
                  hint="Barang diberikan gratis. Kamu bisa menuliskan kebutuhan pengambilan di sini."
                >
                  <textarea
                    id="offer-recipient"
                    className="textarea"
                    maxLength={500}
                    placeholder="Contoh: mohon bawa kendaraan sendiri saat mengambil kursi."
                    value={recipientNote}
                    onChange={event => setRecipientNote(event.target.value)}
                  />
                </Field>
              )}

              {type === 'EXCHANGE' && (
                <Field label="Barang pengganti yang dicari" htmlFor="offer-exchange">
                  <textarea
                    id="offer-exchange"
                    className="textarea"
                    required
                    minLength={3}
                    maxLength={1000}
                    value={exchangePreference}
                    onChange={event => setExchangePreference(event.target.value)}
                  />
                </Field>
              )}
            </section>

            <section className="listing-form-section">
              <h2>Bagaimana barang diserahkan?</h2>

              <CityPicker
                required
                initial={revision?.city ?? initialCity}
                value={cityId}
                onChange={city => setCityId(city.id)}
              />

              <fieldset className="handover-choice">
                <legend>Pilih minimal satu cara serah terima</legend>

                <label>
                  <input
                    type="checkbox"
                    checked={methods.includes('MEETUP')}
                    onChange={() => toggleMethod('MEETUP')}
                  />
                  Bertemu langsung
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={methods.includes('DELIVERY')}
                    onChange={() => toggleMethod('DELIVERY')}
                  />
                  Pengiriman
                </label>
              </fieldset>
            </section>
            <section className="listing-form-section"><h2>Foto di Listing</h2><p>Pilih minimal satu foto barang.</p><div className="listing-photo-choices">{item.media.map(photo => <label key={photo.id}><PrivatePhoto mediaId={photo.id} alt="Foto barang untuk Listing" /><span><input type="checkbox" checked={mediaIds.includes(photo.id)} onChange={() => setMediaIds(current => current.includes(photo.id) ? current.filter(id => id !== photo.id) : [...current, photo.id])} />Pakai foto ini</span></label>)}</div></section>
          </>
        )}
      </fieldset>

      {error && <Notice kind="error">{error}</Notice>}

      {canOffer && (
        <div className="listing-form-footer">
          <p>
            Tim Valora akan meninjau {listing ? 'perubahanmu' : 'pengajuanmu'}. Setelah disetujui,
            barang tampil di Market.{' '}
            <Link href="/app/listings">Pantau pengajuan saya</Link>
          </p>

          <Button type="submit" disabled={saving}>
            {saving
              ? 'Mengirim pengajuan…'
              : listing ? 'Simpan perubahan' : type === 'DONATE'
                ? 'Ajukan donasi'
                : type === 'EXCHANGE'
                  ? 'Ajukan pertukaran'
                  : 'Ajukan penjualan'}
          </Button>
        </div>
      )}
    </form>
  );
}
