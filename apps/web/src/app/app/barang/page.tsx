'use client';

import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { ApiSuccess, ItemDto } from '@valora/contracts';
import { apiEnvelope } from '@/lib/api';
import { ItemCard } from '@/features/items/card';
import { Button, Notice } from "@/components/ui/primitives";
import { AccountHeading } from '@/features/account/heading';
import { AccountSkeleton } from '@/features/account/skeleton';

export default function ItemsPage() {
  const items = useInfiniteQuery<ApiSuccess<ItemDto[]>>({ queryKey: ['items'], initialPageParam: null as string | null, queryFn: ({ pageParam }) => apiEnvelope<ItemDto[]>('/items?limit=20' + (pageParam ? `&cursor=${encodeURIComponent(String(pageParam))}` : '')), getNextPageParam: (last) => last.meta?.nextCursor ?? undefined });
  const all = items.data?.pages.flatMap((page) => page.data) ?? [];
  return <><AccountHeading title="Barang saya" description="Catatan privat barang yang kamu miliki." actions={<Link href="/app/barang/baru" className="button button-primary">Tambah barang</Link>} />{items.isPending ? <AccountSkeleton cards /> : items.isError && !all.length ? <Notice kind="error">Gagal memuat daftar barang. <Button variant="quiet" onClick={() => items.refetch()}>Coba lagi</Button></Notice> : all.length ? <><div className="item-grid">{all.map((item) => <ItemCard key={item.id} item={item} />)}</div>{items.isFetchNextPageError && <Notice kind="error">Barang berikutnya belum dimuat. Barang sebelumnya tetap tersedia.</Notice>}{items.hasNextPage && <div className="form-actions"><Button variant="secondary" disabled={items.isFetchingNextPage} onClick={() => items.fetchNextPage()}>{items.isFetchingNextPage ? 'Memuat…' : items.isFetchNextPageError ? 'Coba muat lagi' : 'Muat lebih banyak'}</Button></div>}</> : <div className="empty-state"><h3>Belum ada barang.</h3><p>Tambahkan satu barang dengan foto, nama, dan cerita singkat.</p><Link className="button button-primary" href="/app/barang/baru">Tambah barang pertama</Link></div>}</>;
}
