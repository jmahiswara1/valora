import { DisputeAdminDetail } from '@/features/admin/disputes/detail';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <DisputeAdminDetail id={id} />; }
