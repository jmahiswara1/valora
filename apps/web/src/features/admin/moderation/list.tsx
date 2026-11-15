'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ModerationQueueDto } from '@valora/contracts';
import { ArrowRight, Search } from 'lucide-react';

import { apiEnvelope } from '@/lib/api';
import { LoadState } from '@/components/ui/query-state';

type Kind = ModerationQueueDto['listingType'];
type Filter = 'ALL' | Kind;

const kinds: Record<Kind, string> = {
  RESELL: 'Jual',
  DONATE: 'Donasi',
  EXCHANGE: 'Tukar',
};

const filters: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'RESELL', label: 'Jual' },
  { value: 'DONATE', label: 'Donasi' },
  { value: 'EXCHANGE', label: 'Tukar' },
];

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const storageKey = 'valora-admin-moderation-filter';

export function ModerationQueuePage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

  // Pertahankan tab jenis barang saat admin kembali dari halaman keputusan.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      const match = filters.find(option => option.value === saved);
      if (match) setFilter(match.value);
    } catch {
      // Filter tetap berfungsi saat penyimpanan browser tidak tersedia.
    }
  }, []);

  const queue = useQuery({
    queryKey: ['admin', 'listing-reviews'],
    queryFn: () =>
      apiEnvelope<ModerationQueueDto[]>('/admin/listing-reviews'),
  });

  function chooseFilter(value: Filter) {
    setFilter(value);
    try {
      sessionStorage.setItem(storageKey, value);
    } catch {
      // Pilihan tetap aktif selama halaman terbuka.
    }
  }

  const rows = queue.data?.data ?? [];
  const queryText = search.trim().toLocaleLowerCase('id-ID');

  const visible = rows.filter(row => {
    const matchesType = filter === 'ALL' || row.listingType === filter;
    const text = [row.title, row.ownerName, row.cityName]
      .join(' ')
      .toLocaleLowerCase('id-ID');

    return matchesType && text.includes(queryText);
  });

  return (
    <div className="moderation-page">
      <header className="app-heading">
        <div>
          <Link href="/app/admin">← Ringkasan admin</Link>
          <h1>Pengajuan barang</h1>
          <p>Pilih pengajuan untuk memeriksa barang dan memberi keputusan.</p>
        </div>
      </header>

      <LoadState query={queue} skeleton />

      {queue.data && (
        <>
          <div className="toolbar">
            <div className="filters" role="group" aria-label="Jenis pengajuan">
              {filters.map(option => {
                const count = option.value === 'ALL'
                  ? rows.length
                  : rows.filter(row => row.listingType === option.value).length;

                return (
                  <button
                    key={option.value}
                    className="filter"
                    type="button"
                    aria-pressed={filter === option.value}
                    onClick={() => chooseFilter(option.value)}
                  >
                    {option.label} <span>{count}</span>
                  </button>
                );
              })}
            </div>

            <label className="search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                aria-label="Cari nama barang, pemilik, atau kota"
                placeholder="Cari barang, pemilik, atau kota"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </label>
          </div>

          {rows.length === 0 ? (
            <div className="empty-state">
              <h2>Semua pengajuan sudah ditangani</h2>
              <p>Pengajuan baru dari pemilik barang akan muncul di sini.</p>
              <Link className="button button-secondary" href="/app/admin">
                Kembali ke ringkasan
              </Link>
            </div>
          ) : visible.length === 0 ? (
            <div className="empty-state">
              <h2>Tidak ada pengajuan yang cocok</h2>
              <p>Coba kata kunci lain atau tampilkan semua jenis barang.</p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setSearch('');
                  chooseFilter('ALL');
                }}
              >
                Tampilkan semua pengajuan
              </button>
            </div>
          ) : (
            <>
              <p className="result-count" role="status">
                {visible.length} pengajuan ditampilkan
              </p>

              <ul className="rows">
                {visible.map(row => (
                  <li key={row.revisionId}>
                    <Link
                      className="review-link"
                      href={`/app/admin/moderasi/${row.revisionId}`}
                    >
                      <div className="row-copy">
                        <div className="tags">
                          <span className="kind">{kinds[row.listingType]}</span>
                          {row.specialReview && (
                            <span className="special">Pemeriksaan khusus</span>
                          )}
                        </div>

                        <h2>{row.title}</h2>
                        <p>{row.ownerName} · {row.cityName}</p>
                        <small>
                          Diajukan {dateFormat.format(new Date(row.submittedAt))}
                          {' · '}Revisi {row.revisionNo}
                        </small>
                      </div>

                      <span className="review-action">
                        Periksa <ArrowRight size={17} aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <style jsx>{`
        .toolbar, .filters, .search, .tags, .review-action {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toolbar {
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 14px;
          margin-block: 20px;
        }

        .filters, .tags {
          flex-wrap: wrap;
        }

        .filter {
          min-height: 42px;
          padding: 8px 14px;
          border: 1px solid #cbd8cc;
          border-radius: 24px;
          background: #fff;
          color: #294333;
          font: inherit;
          cursor: pointer;
        }

        .filter[aria-pressed='true'] {
          background: #254c36;
          color: #fff;
          border-color: #254c36;
        }

        .filter span {
          margin-left: 3px;
          font-weight: 700;
        }

        .search {
          padding: 10px 12px;
          border: 1px solid #cbd8cc;
          border-radius: 10px;
          background: #fff;
          min-width: 0;
        }

        .search:focus-within {
          outline: 2px solid #548264;
        }

        .search input {
          width: min(245px, 100%);
          min-width: 0;
          border: 0;
          outline: 0;
          font: inherit;
          background: transparent;
        }

        .result-count, .row-copy p, .row-copy small {
          color: #506255;
        }

        .rows {
          display: grid;
          gap: 10px;
          list-style: none;
          padding: 0;
        }

        .rows :global(.review-link) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px;
          border: 1px solid #d7e1d7;
          border-radius: 14px;
          background: #fff;
          color: #223d2b;
          text-decoration: none;
        }

        .rows :global(.review-link:hover),
        .rows :global(.review-link:focus-visible) {
          border-color: #588165;
          background: #f6f9f4;
        }

        .row-copy {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .row-copy h2 {
          margin: 7px 0 4px;
          font-size: 1.1rem;
        }

        .row-copy p {
          margin: 0 0 3px;
        }

        .kind, .special {
          padding: 3px 8px;
          border-radius: 6px;
          font-size: .78rem;
          font-weight: 650;
        }

        .kind {
          background: #e8f1e6;
          color: #254d30;
        }

        .special {
          background: #fff0d1;
          color: #694600;
        }

        .review-action {
          flex-shrink: 0;
          font-weight: 650;
        }

        @media (max-width: 600px) {
          .search {
            width: 100%;
          }

          .search input {
            flex: 1;
          }

          .rows :global(.review-link) {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}