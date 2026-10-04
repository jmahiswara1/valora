import { ListingOwnerDetail } from '@/features/listings/detail';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListingOwnerDetail id={id} />;
}
