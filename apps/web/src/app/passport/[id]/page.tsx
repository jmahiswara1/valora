import { PassportPage } from '@/features/passport/page';
import { SiteHeader } from '@/components/layout/header';
import { SiteFooter } from '@/components/layout/footer';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <><SiteHeader /><main className="container section"><PassportPage itemId={id} /></main><SiteFooter /></>; }
