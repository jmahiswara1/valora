'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ImpactDto } from '@valora/contracts';
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Flag,
  Handshake,
  History,
  Package,
  RefreshCw,
  Settings,
  Users,
} from 'lucide-react';

import { api } from '@/lib/api';
import { ImpactSummary } from '../impact/summary';

interface DashboardData {
  queues: {
    moderation: number;
    reports: number;
    disputes: number;
    corrections: number;
    overdue: number;
  };
  impact: ImpactDto;
}

const workQueues = [
  {
    key: 'moderation',
    title: 'Pengajuan barang',
    description: 'Jual, donasi, dan tukar barang',
    href: '/app/admin/moderasi',
    Icon: Package,
  },
  {
    key: 'reports',
    title: 'Laporan pengguna',
    description: 'Laporan aktivitas di platform',
    href: '/app/admin/laporan',
    Icon: Flag,
  },
  {
    key: 'disputes',
    title: 'Sengketa',
    description: 'Masalah antara pihak yang bertransaksi',
    href: '/app/admin/sengketa',
    Icon: Handshake,
  },
  {
    key: 'corrections',
    title: 'Koreksi transaksi',
    description: 'Permintaan perbaikan data transaksi',
    href: '/app/admin/transaksi',
    Icon: ClipboardList,
  },
] as const;

const managementLinks = [
  { label: 'Pengguna', href: '/app/admin/pengguna', Icon: Users },
  { label: 'Kategori dan rubrik', href: '/app/admin/rubrik', Icon: Settings },
  { label: 'Analitik', href: '/app/admin/analitik', Icon: BarChart3 },
  { label: 'Audit dan retensi', href: '/app/admin/audit', Icon: History },
];

export function AdminDashboardPage() {
  const dashboard = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api<DashboardData>('/admin/dashboard'),
    refetchInterval: 30000,
    retry: false,
  });

  const data = dashboard.data;

  const updatedAt = dashboard.dataUpdatedAt
    ? new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(dashboard.dataUpdatedAt)
    : null;

  return (
    <div className="admin-overview">
      <header className="overview-header">
        <div>
          <h1>Ringkasan admin</h1>
          {updatedAt && <p>Terakhir diperbarui pukul {updatedAt}</p>}
        </div>

        <button
          type="button"
          className="refresh-button"
          disabled={dashboard.isFetching}
          onClick={() => void dashboard.refetch()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {dashboard.isFetching ? 'Memperbarui…' : 'Perbarui'}
        </button>
      </header>

      {dashboard.isError && (
        <div className="feedback" role="alert">
          <AlertCircle size={19} aria-hidden="true" />
          <span>
            {data
              ? 'Pembaruan gagal. Angka yang tampil berasal dari pembaruan terakhir.'
              : 'Ringkasan belum berhasil dimuat. Klik Perbarui untuk mencoba lagi.'}
          </span>
        </div>
      )}

      {data && data.queues.overdue > 0 && (
        <aside className="overdue" aria-label="Transaksi terlambat">
          <AlertCircle size={20} aria-hidden="true" />

          <p>
            <strong>{data.queues.overdue} transaksi</strong> melewati target
            serah terima.
          </p>

          <Link href="/app/admin/transaksi">Periksa transaksi →</Link>
        </aside>
      )}

      <div className="overview-columns">
        <section className="overview-panel" aria-labelledby="work-heading">
          <div className="panel-heading">
            <h2 id="work-heading">Antrean kerja</h2>
            <span className="column-label">Menunggu</span>
          </div>

          {dashboard.isPending && (
            <p className="loading-message" role="status">
              Memuat jumlah antrean…
            </p>
          )}

          <ul className="work-list">
            {workQueues.map(({ key, title, description, href, Icon }) => {
              const count = data?.queues[key];

              return (
                <li key={key}>
                  <Link href={href} className="work-row">
                    <span className="work-icon" aria-hidden="true">
                      <Icon size={20} strokeWidth={1.7} />
                    </span>

                    <span className="work-copy">
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>

                    <span
                      className={
                        count !== undefined && count > 0
                          ? 'queue-count has-work'
                          : 'queue-count'
                      }
                      aria-label={
                        count === undefined
                          ? 'Jumlah belum tersedia'
                          : `${count} menunggu`
                      }
                    >
                      {count?.toLocaleString('id-ID') ?? '—'}
                    </span>

                    <ChevronRight
                      size={17}
                      className="row-chevron"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <nav className="overview-panel" aria-labelledby="manage-heading">
          <div className="panel-heading">
            <h2 id="manage-heading">Pengelolaan</h2>
          </div>

          <ul className="management-list">
            {managementLinks.map(({ label, href, Icon }) => (
              <li key={href}>
                <Link href={href} className="management-row">
                  <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                  <span>{label}</span>
                  <ChevronRight
                    size={16}
                    className="row-chevron"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {data && (
        <details className="impact-panel">
          <summary>
            <span>Ringkasan dampak</span>
            <small>Seluruh waktu</small>
            <ChevronDown size={18} className="impact-chevron" aria-hidden="true" />
          </summary>

          <div className="impact-content">
            <ImpactSummary data={data.impact} />
          </div>
        </details>
      )}

      <style jsx global>{`
        .admin-overview {
          --overview-border: #dbe4dc;
          --overview-ink: #203c2b;
          --overview-muted: #56685b;
          display: grid;
          gap: 20px;
          width: 100%;
          max-width: 1120px;
          margin-inline: auto;
          color: var(--overview-ink);
        }

        .admin-overview .overview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          padding-bottom: 6px;
        }

        .admin-overview .overview-header h1 {
          margin: 0;
          font-size: clamp(1.8rem, 3vw, 2.65rem);
          line-height: 1.15;
          letter-spacing: -0.045em;
        }

        .admin-overview .overview-header p {
          margin: 7px 0 0;
          color: var(--overview-muted);
          font-size: 0.875rem;
        }

        .admin-overview .refresh-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 8px 14px;
          border: 1px solid var(--overview-border);
          border-radius: 10px;
          background: #fff;
          color: var(--overview-ink);
          font: inherit;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .admin-overview .refresh-button:disabled {
          color: var(--overview-muted);
          cursor: wait;
        }

        .admin-overview .overview-columns {
          display: grid;
          grid-template-columns: minmax(0, 1.65fr) minmax(230px, 1fr);
          align-items: start;
          gap: 18px;
        }

        .admin-overview .overview-panel,
        .admin-overview .impact-panel {
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--overview-border);
          border-radius: 16px;
          background: #fff;
        }

        .admin-overview .panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 59px;
          padding: 14px 20px;
          border-bottom: 1px solid var(--overview-border);
          background: #f6f8f5;
        }

        .admin-overview .panel-heading h2 {
          margin: 0;
          color: var(--overview-ink);
          font-size: 1.05rem;
          line-height: 1.35;
        }

        .admin-overview .column-label {
          margin-right: 22px;
          color: var(--overview-muted);
          font-size: 0.78rem;
        }

        .admin-overview .work-list,
        .admin-overview .management-list {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .admin-overview .work-list li + li,
        .admin-overview .management-list li + li {
          border-top: 1px solid #edf1ed;
        }

        .admin-overview .work-row,
        .admin-overview .management-row {
          display: grid;
          align-items: center;
          gap: 12px;
          color: var(--overview-ink);
          text-decoration: none;
        }

        .admin-overview .work-row {
          grid-template-columns: 40px minmax(0, 1fr) auto 16px;
          min-height: 78px;
          padding: 14px 20px;
        }

        .admin-overview .management-row {
          grid-template-columns: 20px minmax(0, 1fr) 16px;
          min-height: 54px;
          padding: 12px 20px;
          font-size: 0.92rem;
          font-weight: 600;
        }

        .admin-overview .work-row:hover,
        .admin-overview .management-row:hover,
        .admin-overview .refresh-button:not(:disabled):hover,
        .admin-overview .impact-panel summary:hover {
          background: #f2f7f1;
        }

        .admin-overview :is(a, button, summary):focus-visible {
          outline: 2px solid #39774c;
          outline-offset: -3px;
        }

        .admin-overview .work-icon {
          display: grid;
          width: 40px;
          height: 40px;
          place-items: center;
          border-radius: 11px;
          color: #365f42;
          background: #edf3eb;
        }

        .admin-overview .work-copy {
          display: grid;
          min-width: 0;
          gap: 3px;
          overflow-wrap: anywhere;
        }

        .admin-overview .work-copy strong {
          font-size: 0.97rem;
          line-height: 1.35;
        }

        .admin-overview .work-copy small {
          color: var(--overview-muted);
          font-size: 0.82rem;
          line-height: 1.4;
        }

        .admin-overview .queue-count {
          min-width: 32px;
          padding: 4px 8px;
          border-radius: 8px;
          background: #f0f2ef;
          color: #5b685e;
          text-align: center;
          font-size: 0.85rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .admin-overview .queue-count.has-work {
          background: #dceedd;
          color: #205232;
        }

        .admin-overview .row-chevron,
        .admin-overview .impact-chevron {
          color: #667a69;
        }

        .admin-overview .overdue,
        .admin-overview .feedback {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          padding: 13px 16px;
          border: 1px solid #ead8af;
          border-radius: 12px;
          background: #fff6e5;
          color: #60450f;
          font-size: 0.9rem;
        }

        .admin-overview .overdue p {
          flex: 1 1 220px;
          margin: 0;
        }

        .admin-overview .overdue a {
          color: inherit;
          font-weight: 650;
          text-underline-offset: 3px;
        }

        .admin-overview .loading-message {
          margin: 12px 20px 0;
          color: var(--overview-muted);
          font-size: 0.85rem;
        }

        .admin-overview .impact-panel summary {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 56px;
          padding: 12px 20px;
          list-style: none;
          cursor: pointer;
          font-weight: 650;
        }

        .admin-overview .impact-panel summary::-webkit-details-marker {
          display: none;
        }

        .admin-overview .impact-panel summary small {
          margin-left: auto;
          color: var(--overview-muted);
          font-weight: 500;
        }

        .admin-overview .impact-panel[open] .impact-chevron {
          transform: rotate(180deg);
        }

        .admin-overview .impact-content {
          padding: 0 20px 20px;
        }

        .admin-overview .impact-content .impact-grid {
          margin-block: 8px 16px;
        }

        @media (max-width: 1000px) {
          .admin-overview .overview-columns {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (max-width: 600px) {
          .admin-overview {
            gap: 15px;
          }

          .admin-overview .panel-heading,
          .admin-overview .work-row,
          .admin-overview .management-row,
          .admin-overview .impact-panel summary {
            padding-inline: 14px;
          }

          .admin-overview .work-row {
            grid-template-columns: 34px minmax(0, 1fr) auto 14px;
            gap: 9px;
          }

          .admin-overview .work-icon {
            width: 34px;
            height: 34px;
          }

          .admin-overview .impact-content {
            padding: 0 14px 14px;
          }
        }
      `}</style>
    </div>
  );
}