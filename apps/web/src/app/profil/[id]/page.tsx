import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/public-shell';
import { PublicProfilePage } from '@/features/profile/public';
export const metadata: Metadata = { title: 'Profil pengguna', description: 'Lihat barang aktif dan pengalaman transaksi pengguna Valora.' };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params; await searchParams;
  return <PublicShell><PublicProfilePage id={id} /></PublicShell>;
}
