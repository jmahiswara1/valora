'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3,
  ClipboardList,
  Flag,
  Handshake,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  User,
  Users,
  X,
} from 'lucide-react';

import { useMe, useSession } from '@/lib/session';
import { ChatTrigger } from '@/features/conversations/trigger';
import { ProfileAvatar } from '@/features/profile/avatar';
import { Button, Notice } from '../ui/primitives';

const navigation = [
  {
    href: '/app/admin',
    label: 'Ringkasan admin',
    Icon: LayoutDashboard,
  },
  {
    href: '/app/admin/moderasi',
    label: 'Pengajuan barang',
    Icon: Package,
  },
  {
    href: '/app/admin/laporan',
    label: 'Laporan pengguna',
    Icon: Flag,
  },
  {
    href: '/app/admin/sengketa',
    label: 'Sengketa',
    Icon: Handshake,
  },
  {
    href: '/app/admin/transaksi',
    label: 'Transaksi dan koreksi',
    Icon: ClipboardList,
  },
  {
    href: '/app/admin/pengguna',
    label: 'Pengguna',
    Icon: Users,
  },
  {
    href: '/app/admin/rubrik',
    label: 'Kategori dan rubrik',
    Icon: Settings,
  },
  {
    href: '/app/admin/analitik',
    label: 'Analitik',
    Icon: BarChart3,
  },
  {
    href: '/app/admin/audit',
    label: 'Audit dan retensi',
    Icon: History,
  },
  {
    href: '/app',
    label: 'Akun saya',
    Icon: User,
  },
];

function activeMenu(pathname: string) {
  if (
    pathname === '/app/admin/koreksi' ||
    pathname.startsWith('/app/admin/koreksi/')
  ) {
    return '/app/admin/transaksi';
  }

  return navigation.find(({ href }) => {
    if (href === '/app' || href === '/app/admin') {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  })?.href;
}

export function AdminAppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const me = useMe();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (session.state === 'GUEST') {
      router.replace(`/masuk?next=${encodeURIComponent(pathname)}`);
    }
  }, [session.state, pathname, router]);

  async function logout() {
    setMenuOpen(false);
    await session.logout();
  }

  if (session.state === 'LOGOUT_PENDING') {
    return (
      <div className="container section">
        <Notice>Permintaan keluar belum terkonfirmasi.</Notice>
        <Button disabled={session.logoutBusy} onClick={logout}>
          Coba keluar lagi
        </Button>
      </div>
    );
  }

  if (session.state === 'RESTRICTED') {
    return (
      <div className="container section">
        <Notice kind="error">Akun ini tidak dapat digunakan.</Notice>
        <Button onClick={logout}>Keluar</Button>
      </div>
    );
  }

  if (session.state === 'UNAVAILABLE') {
    return (
      <div className="container section">
        <Notice kind="error">Sesi akun belum bisa diperiksa.</Notice>
        <Button onClick={() => void session.refresh()}>Coba lagi</Button>
      </div>
    );
  }

  if (
    session.state !== 'AUTHENTICATED' ||
    session.verifiedPath !== pathname ||
    !me.data
  ) {
    return (
      <div className="container section" role="status">
        Menyiapkan akun…
      </div>
    );
  }

  const user = me.data;

  if (user.role !== 'ADMIN') {
    return (
      <div className="container section">
        <Notice kind="error">Halaman ini hanya untuk admin.</Notice>
        <Link href="/app">Kembali ke akun saya</Link>
      </div>
    );
  }

  const current = activeMenu(pathname);

  const links = navigation.map(({ href, label, Icon }) => (
    <Link
      key={href}
      href={href}
      aria-current={href === current ? 'page' : undefined}
      onClick={() => setMenuOpen(false)}
    >
      <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
      {label}
    </Link>
  ));

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <Link className="wordmark" href="/">
          valora
        </Link>

        <nav className="app-nav" aria-label="Navigasi admin">
          {links}
        </nav>

        <div className="app-sidebar-bottom">
          <div className="app-sidebar-profile">
            <ProfileAvatar
              photoUrl={user.profilePhotoUrl}
              displayName={user.displayName}
              className="app-sidebar-avatar"
            />

            <div>
              <strong>{user.displayName}</strong>
              <span>{user.city.name}</span>
            </div>
          </div>

          <button
            type="button"
            className="button button-quiet button-small"
            disabled={session.logoutBusy}
            onClick={logout}
          >
            <LogOut size={16} aria-hidden="true" />
            Keluar
          </button>
        </div>
      </aside>

      <div>
        <header className="app-mobile-header">
          <div className="app-mobile-header-top">
            <Link className="wordmark" href="/app/admin">
              valora
            </Link>

            <div className="admin-header-actions">
              <ChatTrigger />

              <button
                type="button"
                className="header-menu-button"
                style={{ display: 'inline-flex' }}
                aria-label={menuOpen ? 'Tutup menu admin' : 'Buka menu admin'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(open => !open)}
              >
                {menuOpen ? (
                  <X size={23} aria-hidden="true" />
                ) : (
                  <Menu size={23} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {menuOpen && (
            <nav aria-label="Navigasi admin seluler">
              {links}
              <button
                type="button"
                disabled={session.logoutBusy}
                onClick={logout}
              >
                Keluar
              </button>
            </nav>
          )}
        </header>

        <main className="app-main">
          {!user.emailVerifiedAt && (
            <div style={{ marginBottom: 28 }}>
              <Notice>
                Alamat email belum diverifikasi.{' '}
                <Link
                  href={`/verifikasi-email?email=${encodeURIComponent(user.email)}`}
                >
                  Kirim ulang tautan verifikasi
                </Link>
              </Notice>
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}