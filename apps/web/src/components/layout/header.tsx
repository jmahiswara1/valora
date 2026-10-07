'use client';

import { NotificationBell } from '@/features/notifications/bell';
import { useSession } from '@/lib/session';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, CircleUserRound, Heart, LayoutDashboard, LogOut, X, Menu } from 'lucide-react';

export function SiteHeader({ appearance = 'classic' }: { appearance?: 'classic' | 'renewed' } = {}) {
  const session = useSession(); const signedIn = session.state === 'AUTHENTICATED';
  const [open, setOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const accountMenu = useRef<HTMLDivElement>(null);
  const accountUser = session.session?.user;
  const active = (href: string) => pathname === href || pathname.startsWith(href + '/') ? 'page' as const : undefined;
  const accountHref = (href: string) => signedIn ? href : '/masuk?next=' + encodeURIComponent(href);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setAccountMenuOpen(false); accountButton.current?.focus(); }
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !accountMenu.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [accountMenuOpen]);
  return <header className="site-header"><div className="container site-header-inner">
    <Link className="wordmark" href="/" onClick={() => { setOpen(false); setAccountMenuOpen(false); }}>valora{appearance !== 'renewed' && <span>jaga nilai barang</span>}</Link>
    <div className="header-actions">
      <nav className="header-nav" aria-label="Navigasi utama">
        <Link href="/market" aria-current={active('/market')} onClick={() => setAccountMenuOpen(false)}>Market</Link>
        <Link href="/cara-kerja" aria-current={active('/cara-kerja')} onClick={() => setAccountMenuOpen(false)}>Cara kerja</Link>
        <Link href="/impact" aria-current={active('/impact')} onClick={() => setAccountMenuOpen(false)}>Impact</Link>
      </nav>
      <nav className="header-icon-nav" aria-label="Akun dan aktivitas">
        {signedIn && <>
          <NotificationBell onOpen={() => { setOpen(false); setAccountMenuOpen(false); }} />
          <Link className="header-icon-link header-activity-link" href={accountHref('/app/penawaran')} prefetch={false} aria-label="Penawaran saya" title="Penawaran saya" onClick={() => setOpen(false)}><ShoppingCart size={19} strokeWidth={1.6} aria-hidden="true" /></Link>
        </>}
        <Link className="header-icon-link header-favorite-link" href={accountHref('/app/favorit')} prefetch={false} aria-label="Favorit" title="Favorit" aria-current={active('/app/favorit')} onClick={() => { setOpen(false); setAccountMenuOpen(false); }}><Heart size={19} strokeWidth={1.6} aria-hidden="true" /></Link>
        <div className="header-account" ref={accountMenu}>
          <button ref={accountButton} className="header-icon-link header-account-trigger" type="button" aria-label="Menu akun" title="Menu akun" aria-expanded={accountMenuOpen} aria-controls="header-account-menu" onClick={() => { setOpen(false); setAccountMenuOpen((value) => !value); }}><CircleUserRound size={19} strokeWidth={1.6} aria-hidden="true" /></button>
          <div id="header-account-menu" className="header-account-popover" role="group" aria-label="Menu akun" hidden={!accountMenuOpen}>
            {signedIn ? <>
              <div className="account-menu-identity"><strong>{accountUser?.displayName ?? 'Akun Valora'}</strong>{accountUser?.email && <span>{accountUser.email}</span>}</div>
              <div className="account-menu-actions">
                <Link href="/app" onClick={() => setAccountMenuOpen(false)}><LayoutDashboard size={17} aria-hidden="true" />Ringkasan</Link>
                <Link href="/app/profil" onClick={() => setAccountMenuOpen(false)}><CircleUserRound size={17} aria-hidden="true" />Profil saya</Link>
                <button type="button" disabled={session.logoutBusy} onClick={() => { setAccountMenuOpen(false); void session.logout(); }}><LogOut size={17} aria-hidden="true" />{session.logoutBusy ? 'Keluar…' : 'Keluar'}</button>
              </div>
            </> : <>
              <div className="account-menu-identity"><strong>Akun Valora</strong><span>Masuk atau buat akun untuk mengelola profil dan barangmu.</span></div>
              <div className="account-menu-actions">
                <Link href="/masuk" onClick={() => setAccountMenuOpen(false)}>Masuk</Link>
                <Link href="/daftar" onClick={() => setAccountMenuOpen(false)}>Daftar</Link>
              </div>
            </>}
          </div>
        </div>
      </nav>
      <button ref={menuButton} className="header-menu-button" type="button" aria-label={open ? 'Tutup menu' : 'Buka menu'} aria-controls="public-mobile-navigation" aria-expanded={open} onClick={() => { setAccountMenuOpen(false); setOpen(!open); }}>{open ? <X size={20} strokeWidth={1.6} aria-hidden="true" /> : <Menu size={20} strokeWidth={1.6} aria-hidden="true" />}</button>
    </div>
  </div>{open && <nav id="public-mobile-navigation" className="container header-mobile-nav" aria-label="Navigasi seluler">
    <Link onClick={() => { setOpen(false); setAccountMenuOpen(false); }} href="/market" aria-current={active('/market')}>Market</Link><Link onClick={() => { setOpen(false); setAccountMenuOpen(false); }} href="/cara-kerja" aria-current={active('/cara-kerja')}>Cara kerja</Link><Link onClick={() => { setOpen(false); setAccountMenuOpen(false); }} href="/impact" aria-current={active('/impact')}>Impact</Link>
    {!signedIn && <Link onClick={() => setOpen(false)} href="/masuk">Masuk</Link>}
    <Link onClick={() => setOpen(false)} href={signedIn ? "/app" : "/daftar"}>{signedIn ? "Ringkasan akun" : "Mulai sekarang"}</Link>
  </nav>}</header>;
}
