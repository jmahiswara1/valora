import type { Metadata } from 'next';
import { PublicListingDetail } from '@/features/market/detail';
import { PublicShell } from '@/components/layout/public-shell';

export const metadata: Metadata = { title: 'Detail barang', description: 'Lihat foto, kondisi, dan pilihan penawaran barang di Market Valora.' };

export default async function Page({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  return <PublicShell><PublicListingDetail key={listingId} listingId={listingId} /></PublicShell>;
}
