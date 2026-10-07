'use client';

import { NotificationBell } from '@/features/notifications/bell';
import { Search, LayoutDashboard, Bell, Heart, Package, Leaf, Store, Handshake, ReceiptText, MessageCircle, Menu, X, Settings, ShieldCheck, LogOut, ChevronRight, ArrowUpRight, ChevronDown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession, useMe } from '@/lib/session';
import { useState, useRef, useEffect } from 'react';
import { Notice, Button } from "../ui/primitives";
import { ProfileAvatar } from '../../features/profile/avatar';

const sections = [
  { label: 'Ruang saya', entries: [
    { href: '/app', label: 'Ringkasan', Icon: LayoutDashboard },
    { href: '/app/notifikasi', label: 'Notifikasi', Icon: Bell },
    { href: '/app/barang', label: 'Barang saya', Icon: Package },
    { href: '/app/impact', label: 'Impact saya', Icon: Leaf },
  ] },
  { label: 'Aktivitas Market', entries: [
    { href: '/app/favorit', label: 'Favorit', Icon: Heart },
    { href: '/app/pencarian', label: 'Pencarian tersimpan', Icon: Search },
    { href: '/app/listings', label: 'Listing saya', Icon: Store },
    { href: '/app/penawaran', label: 'Penawaran', Icon: Handshake },
    { href: '/app/transaksi', label: 'Transaksi', Icon: ReceiptText },
    { href: '/app/pesan', label: 'Pesan', Icon: MessageCircle },
  ] },
];

const routeNames: Record<string, string> = { baru: 'Tambah barang', edit: 'Edit barang', passport: 'Passport', penilaian: 'Penilaian', perbaikan: 'Perawatan', new: 'Buat Listing', profil: 'Profil saya', koreksi: 'Peninjauan koreksi' };

const navigationEntries = sections.flatMap((section) => section.entries);

function accountRoute(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  const correction = pathname === '/app/koreksi' || pathname.startsWith('/app/koreksi/');
  const entry = navigationEntries.find((row) => row.href !== '/app' && (correction ? row.href === '/app/transaksi' : pathname === row.href || pathname.startsWith(row.href + '/')));
  const leaf = correction ? 'Peninjauan koreksi' : parts.at(-2) === 'penilaian' && parts.at(-1) === 'baru' ? 'Penilaian baru' : routeNames[parts.at(-1) ?? ''] ?? (parts.length > 2 ? 'Detail' : '');
  return { entry, leaf, nested: entry && pathname !== entry.href };
}

function AccountNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activeHref = accountRoute(pathname).entry?.href ?? (pathname === '/app' ? '/app' : undefined);
  return <nav className="account-nav" aria-label="Navigasi akun">{sections.map((section) => <div className="account-nav-group" key={section.label}>
    <p className="account-nav-label">{section.label}</p>
    {section.entries.map(({ href, label, Icon }) => <Link key={href} href={href} onClick={onNavigate} aria-current={activeHref === href ? 'page' : undefined}><Icon size={19} strokeWidth={1.7} aria-hidden="true" />{label}</Link>)}
  </div>)}</nav>;
}

function AccountDrawer() {
  const pathname = usePathname(); const session = useSession(); const me = useMe();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  const open = openPath === pathname;
  useEffect(() => {
    const element = dialog.current; const opener = trigger.current;
    if (open) { element?.showModal(); const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { element?.close(); document.body.style.overflow = overflow; opener?.focus(); }; }
  }, [open]);
  useEffect(() => { const media = window.matchMedia('(min-width: 1024px)'); const close = () => { if (media.matches) setOpenPath(null); }; media.addEventListener('change', close); return () => media.removeEventListener('change', close); }, []);
  return <>
    <button ref={trigger} type="button" className="account-icon-button account-menu-trigger" aria-label="Buka navigasi akun" aria-expanded={open} aria-controls="account-drawer" onClick={() => setOpenPath(pathname)}><Menu size={22} /></button>
    <dialog ref={dialog} id="account-drawer" className="account-drawer" aria-labelledby="account-drawer-title" onCancel={(event) => { event.preventDefault(); setOpenPath(null); }} onClick={(event) => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX > bounds.right || event.clientY > bounds.bottom || event.clientY < bounds.top) setOpenPath(null); } }}>
      <div className="account-drawer-top"><Link href="/app" className="wordmark" id="account-drawer-title" onClick={() => setOpenPath(null)}>valora</Link><button type="button" className="account-icon-button" aria-label="Tutup navigasi" onClick={() => setOpenPath(null)}><X size={21} /></button></div>
      <AccountNavigation onNavigate={() => setOpenPath(null)} /><Link href="/market" className="account-profile-link account-drawer-market" onClick={() => setOpenPath(null)}><Store size={19} aria-hidden="true" />Jelajahi Market</Link>
      <div className="account-sidebar-bottom"><Link href="/app/profil" className="account-profile-link" onClick={() => setOpenPath(null)}><Settings size={19} />Profil saya</Link>{me.data?.role === 'ADMIN' && <Link href="/app/admin" className="account-profile-link"><ShieldCheck size={19} />Area admin</Link>}<button type="button" className="account-profile-link" onClick={() => session.logout()}><LogOut size={19} />Keluar</button></div>
    </dialog>
  </>;
}

function Breadcrumbs() {
  const pathname = usePathname(); const { entry, leaf, nested } = accountRoute(pathname);
  return <nav className="account-breadcrumbs" aria-label="Breadcrumb"><Link href="/app">Ruang saya</Link>{entry && <><ChevronRight size={14} aria-hidden="true" />{nested ? <Link href={entry.href}>{entry.label}</Link> : <span aria-current="page">{entry.label}</span>}</>}{leaf && <><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">{leaf}</span></>}</nav>;
}

export function AccountShell({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const pathname = usePathname(); const session = useSession(); const me = useMe();
  useEffect(() => { if (session.state === 'GUEST') router.replace('/masuk?next=' + encodeURIComponent(pathname)); }, [session.state, pathname, router]);
  if (session.state === 'LOGOUT_PENDING') return <div className="account-gate"><Notice>Permintaan keluar belum terkonfirmasi. Data privat disembunyikan.</Notice><Button disabled={session.logoutBusy} onClick={() => session.logout()}>Coba keluar lagi</Button></div>;
  if (session.state === 'RESTRICTED') return <div className="account-gate"><Notice kind="error">Akun ini tidak dapat digunakan.</Notice><Button onClick={() => session.logout()}>Keluar</Button></div>;
  if (session.state === 'UNAVAILABLE') return <div className="account-gate"><Notice kind="error">Koneksi sesi belum tersedia.</Notice><Button onClick={() => session.refresh()}>Coba lagi</Button></div>;
  if (session.state !== 'AUTHENTICATED' || session.verifiedPath !== pathname || !me.data) return <div className="account-gate" role="status">Menyiapkan akun…</div>;
  const user = me.data;
  return <div className="account-shell">
    <a className="account-skip" href="#account-main">Langsung ke konten</a>
    <aside className="account-sidebar"><Link href="/" className="wordmark">valora</Link><AccountNavigation /><div className="account-sidebar-bottom">
      <Link href="/app/profil" className="account-sidebar-person" aria-current={pathname === '/app/profil' ? 'page' : undefined}><ProfileAvatar photoUrl={user.profilePhotoUrl} displayName={user.displayName} className="account-avatar" /><div><strong>{user.displayName}</strong><span>{user.city.name}</span></div><Settings size={17} aria-hidden="true" /></Link>
      {user.role === 'ADMIN' && <Link href="/app/admin" className="account-profile-link"><ShieldCheck size={18} />Area admin</Link>}
      <button type="button" className="account-profile-link" onClick={() => session.logout()}><LogOut size={18} />Keluar</button>
    </div></aside>
    <div className="account-workspace"><header className="account-toolbar"><div className="account-toolbar-start"><AccountDrawer /><Breadcrumbs /><Link href="/app" className="wordmark account-mobile-wordmark">valora</Link></div><div className="account-toolbar-end"><Link href="/market" className="account-market-link" aria-label="Market" title="Market"><span>Market</span> <ArrowUpRight className="account-market-arrow" size={16} aria-hidden="true" /><Store className="account-market-icon" size={19} aria-hidden="true" /></Link><NotificationBell appearance="account" onOpen={() => document.getElementById('account-user-menu')?.hidePopover()} /><Link href="/app/favorit" className="account-icon-button" prefetch={false} aria-label="Favorit" title="Favorit" aria-current={pathname === '/app/favorit' ? 'page' : undefined}><Heart size={19} strokeWidth={1.7} aria-hidden="true" /></Link><button type="button" className="account-user-trigger" popoverTarget="account-user-menu" aria-label="Buka menu akun"><ProfileAvatar photoUrl={user.profilePhotoUrl} displayName={user.displayName} className="account-avatar" /><ChevronDown size={15} aria-hidden="true" /></button><div id="account-user-menu" className="account-user-menu" popover="auto"><p>{user.displayName}</p><Link href="/app/profil" onClick={() => document.getElementById('account-user-menu')?.hidePopover()}><Settings size={17} />Profil saya</Link><button type="button" onClick={() => session.logout()}><LogOut size={17} />Keluar</button></div></div></header>
      <main id="account-main" className="account-main" tabIndex={-1}>{!user.emailVerifiedAt && <div className="account-verification"><Notice>Alamat email belum diverifikasi. <Link href={`/verifikasi-email?email=${encodeURIComponent(user.email)}`}>Kirim ulang tautan</Link>. Kamu tetap bisa menyimpan barang.</Notice></div>}{children}</main>
    </div>
  </div>;
}
