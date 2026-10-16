import { TutorialCatalog } from '@/features/tutorials/catalog';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <TutorialCatalog itemId={id} />; }
