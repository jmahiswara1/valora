'use client';

import Link from 'next/link';
import type { ItemDto } from '@valora/contracts';

import { PrivatePhoto } from './photo';

const categoryNames: Record<string, string> = {
  electronics: 'Elektronik',
  furniture: 'Furnitur',
  fashion: 'Pakaian',
  books: 'Buku',
  household: 'Rumah tangga',
  sports: 'Olahraga',
  hobby: 'Hobi',
};

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
});

interface ItemCardProps {
  item: ItemDto;
  showActions?: boolean;
}

export function ItemCard({ item, showActions = false }: ItemCardProps) {
  const detailUrl = `/app/barang/${item.id}`;
  const offerUrl = `/app/listings/new?itemId=${encodeURIComponent(item.id)}`;

  return (
    <article className="item-card">
      <Link
        href={detailUrl}
        aria-label={`Lihat detail ${item.title}`}
        style={{
          display: 'block',
          color: 'inherit',
          textDecoration: 'none',
        }}
      >
        <div className="item-card-media">
          <PrivatePhoto
            mediaId={item.media[0]?.id}
            alt={`Foto ${item.title}`}
          />
        </div>

        <div className="item-card-body">
          <span className="item-category">
            {categoryNames[item.categoryCode] ?? item.categoryCode}
          </span>

          <h3>{item.title}</h3>

          <p>
            Diperbarui {dateFormat.format(new Date(item.updatedAt))}
          </p>

          {item.reservedByTransactionId && (
            <span className="badge">Dalam transaksi</span>
          )}
        </div>
      </Link>

      {showActions && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            padding: '0 12px 12px',
          }}
        >
          {item.reservedByTransactionId ? (
            <Link className="button button-secondary" href="/app/transaksi">
              Lihat transaksi
            </Link>
          ) : (
            <>
              <Link
                className="button button-primary"
                href={`${offerUrl}&type=RESELL`}
                aria-label={`Jual ${item.title}`}
              >
                Jual
              </Link>

              <Link
                className="button button-secondary"
                href={`${offerUrl}&type=DONATE`}
                aria-label={`Donasikan ${item.title}`}
              >
                Donasikan
              </Link>
            </>
          )}
        </div>
      )}
    </article>
  );
}