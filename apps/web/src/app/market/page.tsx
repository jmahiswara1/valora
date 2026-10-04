import type { Metadata } from 'next';
import { MarketPage } from '@/features/market/catalog';
import { PublicShell } from '@/components/layout/public-shell';

export const metadata: Metadata = { title: 'Market', description: 'Jelajahi barang yang ditawarkan di Market Valora.' };

export default async function Page({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const { category } = await searchParams;
  const initialCategory = Array.isArray(category) ? category[0] ?? '' : category ?? '';
  return <PublicShell><MarketPage key={initialCategory} initialCategory={initialCategory} /></PublicShell>;
}
