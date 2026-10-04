import { ImpactPage } from '@/features/impact/page';
import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/public-shell';
export const metadata: Metadata = { title: 'Impact', description: 'Catatan penilaian, perbaikan, dan transfer barang yang tercatat di Valora.' };
export default function Page() { return <PublicShell><main id="main-content" className="container public-information"><ImpactPage publicView /></main></PublicShell>; }
