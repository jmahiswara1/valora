'use client';

import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { ItemDto } from '@valora/contracts';

import { apiEnvelope } from '@/lib/api';
import { ItemCard } from '@/features/items/card';
import { AccountHeading } from '@/features/account/heading';
import { AccountSkeleton } from '@/features/account/skeleton';
import { Button, Notice } from '@/components/ui/primitives';

export default function ItemsPage() {
  const items = useInfiniteQuery({
    queryKey: ['items'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) params.set('cursor', pageParam);

      return apiEnvelope<ItemDto[]>(`/items?${params}`);
    },
    getNextPageParam: page => page.meta?.nextCursor ?? undefined,
  });

  const rows = items.data?.pages.flatMap(page => page.data) ?? [];

  return (
    <>
      <AccountHeading
        title="Barang saya"
        description="Pilih barang yang ingin kamu jual atau donasikan."
        actions={
          <Link className="button button-primary" href="/app/barang/baru">
            Tambah barang
          </Link>
        }
      />

      <nav
        aria-label="Aktivitas barang"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 24,
        }}
      >
        <Link className="button button-secondary" href="/app/listings">
          Pantau pengajuan saya
        </Link>

        <Link className="button button-secondary" href="/market?type=RESELL">
          Cari barang jualan
        </Link>

        <Link className="button button-secondary" href="/market?type=DONATE">
          Cari barang donasi
        </Link>
      </nav>

      {items.isPending ? (
        <AccountSkeleton cards />
      ) : items.isError && rows.length === 0 ? (
        <Notice kind="error">
          Daftar barang gagal dimuat.{' '}
          <Button variant="quiet" onClick={() => void items.refetch()}>
            Coba lagi
          </Button>
        </Notice>
      ) : rows.length === 0 ? (
        <section className="empty-state">
          <h2>Barang apa yang ingin kamu tawarkan?</h2>
          <p>
            Tambahkan foto dan keterangan barang. Setelah tersimpan,
            pilih Jual atau Donasikan pada kartu barangmu.
          </p>

          <Link className="button button-primary" href="/app/barang/baru">
            Tambah barang pertama
          </Link>
        </section>
      ) : (
        <>
          <div className="item-grid">
            {rows.map(item => (
              <ItemCard key={item.id} item={item} showActions />
            ))}
          </div>

          {items.isFetchNextPageError && (
            <Notice kind="error">Halaman berikutnya gagal dimuat.</Notice>
          )}

          {items.hasNextPage && (
            <div className="form-actions">
              <Button
                variant="secondary"
                disabled={items.isFetchingNextPage}
                onClick={() => void items.fetchNextPage()}
              >
                {items.isFetchingNextPage
                  ? 'Memuat…'
                  : items.isFetchNextPageError
                    ? 'Coba muat lagi'
                    : 'Muat barang lainnya'}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}