'use client';

import { Select } from '@/components/ui/select';

import { useState, useRef } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api, apiEnvelope } from '@/lib/api';
import type { CategoryDto, CityDto, PublicListingDto } from '@valora/contracts';
import { listingMoney } from './labels';
import Image from 'next/image';
import { ArrowUpRight, Search, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { Input, Button, Field, Notice } from "../../components/ui/primitives";
import { MarketGrid } from './grid';

import { useSearchParams } from 'next/navigation';
import { parseMarketSearch, marketSearchUrl } from '@valora/contracts';
import { SaveSearchButton } from '@/features/searches/save';
import { useSearchLabels } from '@/features/searches/criteria';

type Filters = Record<string, string>;

const types = [['', 'Semua'], ['RESELL', 'Jual kembali'], ['EXCHANGE', 'Tukar'], ['DONATE', 'Donasi']] as const;

const conditions: Record<string, string> = { EXCELLENT: 'Sangat baik', GOOD: 'Baik', NEEDS_ATTENTION: 'Perlu perhatian' };

export function MarketPage() {
  const params = useSearchParams(), urlKey = params.toString();
  const parsed = parseMarketSearch(new URLSearchParams(urlKey));
  const searchQuery = parsed.success ? parsed.data : { sort: 'newest' as const };
  const filters: Filters = Object.fromEntries(Object.entries(searchQuery).map(([key, value]) => [key, String(value)]));
  const { cityLabel } = useSearchLabels(searchQuery);
  const [observedUrl, setObservedUrl] = useState(urlKey);
  function setFilters(action: Filters | ((old: Filters) => Filters)) {
    const next = typeof action === 'function' ? action(filters) : action;
    const result = parseMarketSearch(new URLSearchParams(next));
    if (result.success) { const url = marketSearchUrl(result.data, result.data.sort); if (url !== '/market' + (urlKey ? '?' + urlKey : '')) window.history.pushState(null, '', url); }
  }
  const [q, setQ] = useState(filters.q ?? '');
  const [panelOpen, setPanelOpen] = useState(false);
  const [condition, setCondition] = useState(filters.condition ?? '');
  const [cityQuery, setCityQuery] = useState('');
  const [cityId, setCityId] = useState(filters.cityId ?? '');
  const [appliedCity, setAppliedCity] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  const [minPrice, setMinPrice] = useState(filters.minPriceIdr ?? '');
  const [maxPrice, setMaxPrice] = useState(filters.maxPriceIdr ?? '');
  const [cityError, setCityError] = useState('');
  const [priceError, setPriceError] = useState('');
  // URL navigation restores drafts; typing alone keeps the applied search intact.
  if (observedUrl !== urlKey) {
    setObservedUrl(urlKey); setQ(filters.q ?? ''); setCondition(filters.condition ?? '');
    setCityId(filters.cityId ?? ''); setCityQuery(''); setAppliedCity(''); setCityOpen(false);
    setMinPrice(filters.minPriceIdr ?? ''); setMaxPrice(filters.maxPriceIdr ?? '');
    setCityError(''); setPriceError('');
  }
  const cityInput = useRef<HTMLInputElement>(null);
  const cityList = useRef<HTMLDivElement>(null);
  const minInput = useRef<HTMLInputElement>(null);
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<CategoryDto[]>('/categories'), staleTime: 60_000 });
  const cities = useQuery({
    queryKey: ['market-city-search', cityQuery.trim()],
    queryFn: () => api<CityDto[]>(`/cities?q=${encodeURIComponent(cityQuery.trim())}`),
    enabled: cityOpen && !cityId && cityQuery.trim().length >= 2, staleTime: 60_000,
  });
  const cityExpanded = cityOpen && !cityId && cityQuery.trim().length >= 2;
  const queryString = new URLSearchParams({ ...filters, limit: '20' }).toString();
  const listings = useInfiniteQuery({
    queryKey: ['market', 'catalog', filters], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => apiEnvelope<PublicListingDto[]>(`/market?${queryString}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: page => page.meta?.nextCursor ?? undefined, enabled: parsed.success,
  });
  const rows = listings.data?.pages.flatMap(page => page.data).filter(row => row.status === 'ACTIVE') ?? [];
  const priceEnabled = !filters.type || filters.type === 'RESELL';
  const extraCount = ['condition', 'cityId', 'minPriceIdr', 'maxPriceIdr'].filter(key => filters[key]).length;

  function changeType(type: string) {
    if (type === 'EXCHANGE' || type === 'DONATE') {
      setMinPrice(''); setMaxPrice(''); setPriceError('');
    }
    setFilters(old => {
      const next = { ...old };
      if (type) next.type = type; else delete next.type;
      if (type === 'EXCHANGE' || type === 'DONATE') { delete next.minPriceIdr; delete next.maxPriceIdr; }
      if (type !== 'RESELL' && next.sort?.startsWith('price_')) next.sort = 'newest';
      return next;
    });
  }
  function applyExtras(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalidCity = cityQuery.trim() && !cityId;
    const invalidPrice = priceEnabled && ((minPrice !== '' && !Number.isSafeInteger(Number(minPrice))) || (maxPrice !== '' && !Number.isSafeInteger(Number(maxPrice))) || (minPrice !== '' && maxPrice !== '' && Number(minPrice) > Number(maxPrice)));
    setCityError(invalidCity ? 'Pilih kota dari hasil pencarian, atau kosongkan kolom kota.' : '');
    setPriceError(invalidPrice ? 'Gunakan angka yang valid; harga minimum tidak boleh melebihi maksimum.' : '');
    if (invalidCity) { cityInput.current?.focus(); return; }
    if (invalidPrice) { minInput.current?.focus(); return; }
    setAppliedCity(cityId ? cityQuery : '');
    setFilters(old => {
      const next = { ...old };
      for (const key of ['condition', 'cityId', 'minPriceIdr', 'maxPriceIdr']) delete next[key];
      if (condition) next.condition = condition;
      if (cityId) next.cityId = cityId;
      if (priceEnabled && minPrice !== '') next.minPriceIdr = minPrice;
      if (priceEnabled && maxPrice !== '') next.maxPriceIdr = maxPrice;
      return next;
    });
  }
  function removeFilter(key: string) {
    if (key === 'q') setQ('');
    if (key === 'condition') setCondition('');
    if (key === 'cityId') { setCityQuery(''); setCityId(''); setAppliedCity(''); setCityError(''); setCityOpen(false); }
    if (key === 'minPriceIdr') { setMinPrice(''); setPriceError(''); }
    if (key === 'maxPriceIdr') { setMaxPrice(''); setPriceError(''); }
    if (key === 'type') { changeType(''); return; }
    setFilters(old => { const next = { ...old }; delete next[key]; return next; });
  }
  function reset() {
    setFilters({}); setQ(''); setCondition(''); setCityQuery(''); setCityId(''); setAppliedCity('');
    setCityOpen(false); setMinPrice(''); setMaxPrice(''); setCityError(''); setPriceError('');
  }
  const chipLabels: Record<string, string> = {
    q: `Pencarian: ${filters.q}`, category: categories.data?.find(entry => entry.code === filters.category)?.name ?? filters.category,
    type: types.find(([value]) => value === filters.type)?.[1] ?? '', condition: conditions[filters.condition],
    cityId: cityLabel || appliedCity || 'Kota tersimpan', minPriceIdr: `Min. ${listingMoney(Number(filters.minPriceIdr))}`, maxPriceIdr: `Maks. ${listingMoney(Number(filters.maxPriceIdr))}`,
  };
  const chips = Object.entries(filters).filter(([key, value]) => key !== 'sort' && value);

  return <main id="main-content" className="container market-catalog">
    <section className="catalog-hero" aria-labelledby="market-title">
      <Image src="/images/editorial/valora-hero-v2.png" alt="" fill sizes="100vw" preload className="catalog-hero-photo" />
      <div className="catalog-hero-shade" />
      <div className="catalog-hero-copy"><h1 id="market-title">Barang baik,<br />untuk cerita berikutnya.</h1><p>Temukan barang untuk keseharianmu. Jual kembali, tukar, atau terima lewat donasi.</p></div>
      <a href="#market-results" className="button catalog-hero-link">Jelajahi barang <ArrowUpRight size={18} aria-hidden="true" /></a>
    </section>

    <section className="catalog-discovery" aria-label="Pencarian dan kategori">
      <form className="catalog-search" onSubmit={event => { event.preventDefault(); setFilters(old => { const next = { ...old }; if (q.trim()) next.q = q.trim(); else delete next.q; return next; }); }}>
        <label className="catalog-sr-only" htmlFor="market-q">Cari barang</label><Search size={20} aria-hidden="true" />
        <Input id="market-q" type="search" maxLength={100} value={q} onChange={event => setQ(event.target.value)} placeholder="Cari barang yang kamu butuhkan" />
        <Button type="submit">Cari <ArrowUpRight size={17} aria-hidden="true" /></Button>
      </form>
      <div className="catalog-categories" role="group" aria-label="Kategori barang">
        <button type="button" className="catalog-pill" aria-pressed={!filters.category} onClick={() => removeFilter('category')}>Semua kategori</button>
        {categories.data?.map(entry => <button type="button" className="catalog-pill" key={entry.code} aria-pressed={filters.category === entry.code} onClick={() => setFilters(old => ({ ...old, category: entry.code }))}>{entry.name}</button>)}
        {categories.isPending && <span className="catalog-category-status" role="status">Memuat kategori…</span>}
        {categories.isError && <span className="catalog-category-status" role="status">Kategori gagal dimuat. <button className="link-button" type="button" onClick={() => categories.refetch()}>Coba lagi</button></span>}
      </div>
    </section>

    <section id="market-results" className="catalog-results" aria-labelledby="catalog-heading">
      <div className="catalog-results-title"><div><h2 id="catalog-heading">Temukan yang kamu perlu.</h2><p>Kondisi dan detail berasal dari laporan pemilik; barang yang tampil telah melewati review awal.</p></div><span className="catalog-result-count" role="status">{listings.isPending ? 'Memuat barang…' : listings.isFetching && !listings.isFetchingNextPage ? 'Memperbarui hasil…' : listings.data ? `${rows.length} barang dimuat` : ''}</span></div>
      <div className="catalog-toolbar">
        <div className="catalog-types" role="group" aria-label="Jenis penawaran">{types.map(([value, label]) => <button type="button" className="catalog-pill" key={value} aria-pressed={(filters.type ?? '') === value} onClick={() => changeType(value)}>{label}</button>)}</div>
        <div className="catalog-controls"><label className="catalog-sort" htmlFor="market-sort"><span>Urutkan</span><Select id="market-sort" value={filters.sort ?? 'newest'} onChange={event => setFilters(old => ({ ...old, sort: event.target.value }))}><option value="newest">Terbaru</option><option value="score_desc">Kondisi terbaik</option>{filters.type === 'RESELL' && <><option value="price_asc">Harga terendah</option><option value="price_desc">Harga tertinggi</option></>}</Select></label>
          <Button variant="secondary" className="catalog-filter-toggle" aria-expanded={panelOpen} aria-controls="market-extra-filters" onClick={() => setPanelOpen(!panelOpen)}><SlidersHorizontal size={17} aria-hidden="true" /> Filter{extraCount > 0 && <span className="catalog-filter-count">{extraCount}</span>}</Button></div>
      </div>
      <SaveSearchButton query={searchQuery} valid={parsed.success} />
      {!parsed.success && <Notice kind="error">Parameter pencarian tidak valid. <button type="button" className="link-button" onClick={reset}>Reset filter</button></Notice>}
      <form id="market-extra-filters" className="catalog-filter-panel" hidden={!panelOpen} onSubmit={applyExtras}>
        <div className="catalog-extra-grid">
          <Field label="Kondisi" htmlFor="market-condition"><Select className="select" id="market-condition" value={condition} onChange={event => setCondition(event.target.value)}><option value="">Semua kondisi</option>{Object.entries(conditions).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select></Field>
          <div className="catalog-city" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setCityOpen(false); }}>
            <Field label="Kabupaten/kota" htmlFor="market-city" hint="Ketik minimal dua huruf, lalu pilih kota." error={cityError}>
              <Input ref={cityInput} id="market-city" value={cityQuery || (cityId ? cityLabel : '')} autoComplete="off" placeholder="Cari kota" role="combobox" aria-autocomplete="list" aria-expanded={cityExpanded} aria-controls={cityExpanded ? 'market-city-options' : undefined} aria-describedby={`market-city-hint${cityError ? ' market-city-error' : ''}`} aria-invalid={cityError ? true : undefined} onFocus={() => setCityOpen(true)} onChange={event => { setCityQuery(event.target.value); setCityId(''); setCityOpen(true); setCityError(''); }} onKeyDown={event => {
                if (event.key === 'Escape') { setCityOpen(false); event.stopPropagation(); }
                if (event.key === 'ArrowDown' && cities.data?.length) { event.preventDefault(); setCityOpen(true); requestAnimationFrame(() => cityList.current?.querySelector<HTMLButtonElement>('button')?.focus()); }
              }} />
            </Field>
            {cityExpanded && <div ref={cityList} id="market-city-options" className="catalog-city-options" role="listbox" aria-label="Pilihan kota" onKeyDown={event => {
              if (event.key === 'Escape') { cityInput.current?.focus(); setCityOpen(false); event.stopPropagation(); }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const buttons = Array.from(cityList.current?.querySelectorAll<HTMLButtonElement>('button') ?? []); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
            }}>
              {cities.isPending ? <p role="status">Mencari kota…</p> : cities.isError ? <p role="status">Kota gagal dimuat. <button type="button" className="link-button" onClick={() => cities.refetch()}>Coba lagi</button></p> : cities.data?.length ? cities.data.map(city => <button type="button" role="option" aria-selected={city.id === cityId} key={city.id} onMouseDown={event => event.preventDefault()} onClick={() => { setCityId(city.id); setCityQuery(`${city.name}, ${city.provinceName}`); setCityError(''); cityInput.current?.focus(); setCityOpen(false); }}>{city.name}<small>{city.provinceName}</small></button>) : <p role="status">Tidak ada kota yang cocok.</p>}
            </div>}
          </div>
          <Field label="Harga minimum" htmlFor="market-min"><Input ref={minInput} id="market-min" inputMode="numeric" value={minPrice} disabled={!priceEnabled} aria-invalid={priceError ? true : undefined} aria-describedby={priceError ? 'market-price-error' : 'market-price-hint'} onChange={event => { setMinPrice(event.target.value.replace(/\D/g, '')); setPriceError(''); }} placeholder="Rp 0" /></Field>
          <Field label="Harga maksimum" htmlFor="market-max"><Input id="market-max" inputMode="numeric" value={maxPrice} disabled={!priceEnabled} aria-invalid={priceError ? true : undefined} aria-describedby={priceError ? 'market-price-error' : 'market-price-hint'} onChange={event => { setMaxPrice(event.target.value.replace(/\D/g, '')); setPriceError(''); }} placeholder="Tanpa batas" /></Field>
        </div>
        <div className="catalog-panel-bottom"><div><p id="market-price-hint">Filter harga berlaku untuk barang jual kembali.</p>{priceError && <p id="market-price-error" className="field-error" role="alert">{priceError}</p>}</div><Button type="submit">Terapkan filter <ArrowUpRight size={17} aria-hidden="true" /></Button></div>
      </form>
      {(chips.length > 0 || filters.sort && filters.sort !== 'newest') && <div className="catalog-active-filters" role="group" aria-label="Filter aktif">{chips.map(([key]) => <button type="button" className="catalog-filter-chip" key={key} onClick={() => removeFilter(key)} aria-label={`Hapus filter ${chipLabels[key]}`}>{chipLabels[key]}<X size={14} aria-hidden="true" /></button>)}<button type="button" className="catalog-reset link-button" onClick={reset}>Reset filter</button></div>}

      {!parsed.success ? null : listings.isPending ? <div className="catalog-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="catalog-skeleton" key={index}><div /><span /><span /><span /></div>)}</div>
        : listings.isError && !listings.data ? <Notice kind="error">Market gagal dimuat. <button type="button" className="link-button" onClick={() => listings.refetch()}>Coba lagi</button></Notice>
        : rows.length > 0 ? <><MarketGrid listings={rows} busy={listings.isFetching} />
          {listings.isFetchNextPageError && <div className="catalog-pagination-error"><Notice kind="error">Barang berikutnya gagal dimuat. Barang yang sudah tampil tetap tersedia.</Notice></div>}
          {listings.hasNextPage && <div className="catalog-load-more"><Button variant="secondary" disabled={listings.isFetchingNextPage} onClick={() => listings.fetchNextPage()}>{listings.isFetchingNextPage ? 'Memuat…' : listings.isFetchNextPageError ? 'Coba muat lagi' : 'Muat lebih banyak'}<ChevronDown size={17} aria-hidden="true" /></Button></div>}</>
          : <div className="catalog-empty"><Search size={28} strokeWidth={1.4} aria-hidden="true" /><h3>Belum ada barang yang cocok.</h3><p>Coba kata kunci lain atau hapus filter untuk melihat lebih banyak barang.</p><Button variant="secondary" onClick={reset}>Reset filter</Button></div>}
    </section>
  </main>;
}
