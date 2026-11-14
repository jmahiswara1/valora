import { ListingCreateForm } from '@/features/listings/form';

interface PageProps {
  searchParams: Promise<{
    itemId?: string | string[];
    type?: string | string[];
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;

  const initialItemId =
    typeof params.itemId === 'string' ? params.itemId : '';

  const initialType =
    params.type === 'DONATE' || params.type === 'EXCHANGE'
      ? params.type
      : 'RESELL';

  return (
    <ListingCreateForm
      key={`${initialItemId}-${initialType}`}
      initialItemId={initialItemId}
      initialType={initialType}
    />
  );
}