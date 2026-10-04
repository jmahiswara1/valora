'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, apiEnvelope } from '@/lib/api';
import type { CategoryDto, PublicListingDto } from '@valora/contracts';
import { Notice, Button } from "../../components/ui/primitives";
import Link from 'next/link';
import { ArrowUpRight, Search, ArrowRight } from 'lucide-react';
import { MarketCard } from './card';

export function LandingMarket() {
  const [category, setCategory] = useState('');
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<CategoryDto[]>('/categories'), staleTime: 60_000 });
  const query = new URLSearchParams({ limit: '6', sort: 'newest', ...(category ? { category } : {}) });
  const listings = useQuery({
    queryKey: ['market', 'home-preview', category],
    queryFn: () => apiEnvelope<PublicListingDto[]>(`/market?${query}`),
  });
  const activeListings = listings.data?.data.filter((row) => row.status === 'ACTIVE') ?? [];
  const marketHref = category ? `/market?${new URLSearchParams({ category })}` : '/market';

  return <section className="landing-market" aria-labelledby="landing-market-heading">
    <div className="public-section-heading public-section-heading-center">
      <h2 id="landing-market-heading">Temukan yang kamu butuhkan.</h2>
      <p>Elektronik, furnitur, buku, hingga barang hobi. Temukan barang yang siap punya cerita berikutnya.</p>
    </div>
    <div className="category-scroll" role="group" aria-label="Kategori barang">
      <button className="category-pill" type="button" aria-pressed={category === ''} onClick={() => setCategory('')}>Semua</button>
      {categories.data?.map((entry) => <button className="category-pill" type="button" aria-pressed={category === entry.code} key={entry.code} onClick={() => setCategory(entry.code)}>{entry.name}</button>)}
      {categories.isPending && <span className="category-loading" role="status">Memuat kategori…</span>}
    </div>
    {categories.isError && <div className="preview-category-error"><Notice kind="error">Kategori belum dapat dimuat. <Button variant="quiet" size="small" onClick={() => categories.refetch()}>Coba lagi</Button></Notice></div>}
    <div className="preview-results-heading"><span>Terbaru di Market</span><Link href={marketHref}>Lihat semua <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
    <div className="preview-results" aria-busy={listings.isPending}>
      {listings.isPending ? <div className="preview-loading" role="status" aria-label="Memuat barang dari Market">
        <div className="preview-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="preview-skeleton" key={index}><div /><span /><span /></div>)}</div>
      </div> : listings.isError ? <Notice kind="error">Barang dari Market belum dapat dimuat. <Button variant="quiet" size="small" onClick={() => listings.refetch()}>Coba lagi</Button></Notice> : activeListings.length ? <div className="preview-grid">{activeListings.map((listing) => <MarketCard listing={listing} key={listing.id} />)}</div> : <div className="preview-empty" role="status">
        <Search size={28} strokeWidth={1.5} aria-hidden="true" />
        <h3>Belum ada barang di pilihan ini.</h3>
        <p>Coba kategori lain atau jelajahi seluruh Market.</p>
        {category && <Button variant="secondary" onClick={() => setCategory('')}>Lihat semua kategori</Button>}
      </div>}
    </div>
    <div className="preview-more"><Link className="button button-secondary" href={marketHref}>Jelajahi Market <ArrowRight size={18} aria-hidden="true" /></Link></div>
  </section>;
}
