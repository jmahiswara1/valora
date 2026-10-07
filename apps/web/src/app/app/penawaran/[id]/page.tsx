import type { Metadata } from 'next';
import { OfferDetail } from '@/features/offers/list';

export const metadata: Metadata = { title: 'Detail penawaran' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OfferDetail id={id} />;
}
