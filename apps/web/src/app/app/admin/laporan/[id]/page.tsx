import { ReportDetailPage } from '@/features/admin/reports/detail';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ReportDetailPage id={id} />; }
