import { PassportPage } from '@/features/passport/page';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PassportPage itemId={id} owner />; }
