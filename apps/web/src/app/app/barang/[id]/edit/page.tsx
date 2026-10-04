'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { ItemDto } from '@valora/contracts';
import { api } from '@/lib/api';
import { ItemForm } from '@/features/items/form';
import { Notice } from "@/components/ui/primitives";
import { AccountError } from '@/features/account/error';
import { AccountSkeleton } from '@/features/account/skeleton';

export default function Page() { const { id } = useParams<{ id: string }>(); const query = useQuery({ queryKey: ['item', id], queryFn: () => api<ItemDto>(`/items/${id}`) }); if (query.isPending) return <AccountSkeleton />; if (query.isError) return <AccountError retry={() => query.refetch()}>Barang tidak ditemukan atau gagal dimuat. <Link href="/app/barang">Kembali ke daftar</Link></AccountError>; if (query.data.reservedByTransactionId) return <Notice>Barang sedang direservasi dan belum dapat diubah. <Link href={`/app/transaksi/${query.data.reservedByTransactionId}`}>Buka transaksi</Link></Notice>; return <><div className="app-heading"><div><h1>Edit {query.data.title}</h1><p>Perbarui cerita dan kondisi barangmu.</p></div></div><ItemForm item={query.data} /></>; }
