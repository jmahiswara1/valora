import type { Metadata } from 'next';
import { MarketPage } from '@/features/market/catalog';
import { PublicShell } from '@/components/layout/public-shell';

export const metadata: Metadata = { title: 'Market', description: 'Jelajahi barang yang ditawarkan di Market Valora.' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await searchParams;
  return <PublicShell><MarketPage /></PublicShell>;
}
