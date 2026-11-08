'use client';

import { HeaderAccountActions } from './header-account-actions';
import { useSession } from '@/lib/session';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { X, Menu } from 'lucide-react';

export function SiteHeader({ appearance = 'classic' }: { appearance?: 'classic' | 'renewed' } = {}) {
  const session = useSession(); const signedIn = session.state === 'AUTHENTICATED';
  const [open, setOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);
  const active = (href: string) => pathname === href || pathname.startsWith(href + '/') ? 'page' as const : undefined;
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  return <header className="site-header"><div className="container site-header-inner">
    <Link className="wordmark" href="/" onClick={() => { setOpen(false); setAccountMenuOpen(false); }}>valora{appearance !== 'renewed' && <span>jaga nilai barang</span>}</Link>
    <div className="header-actions">
      <nav className="header-nav" aria-label="Navigasi utama">
        <Link href="/market" aria-current={active('/market')} onClick={() => setAccountMenuOpen(false)}>Market</Link>
        <Link href="/cara-kerja" aria-current={active('/cara-kerja')} onClick={() => setAccountMenuOpen(false)}>Cara kerja</Link>
        <Link href="/impact" aria-current={active('/impact')} onClick={() => setAccountMenuOpen(false)}>Impact</Link>
      </nav>
      <HeaderAccountActions open={accountMenuOpen} onOpenChange={setAccountMenuOpen} onInteract={() => setOpen(false)} />
      <button ref={menuButton} className="header-menu-button" type="button" aria-label={open ? 'Tutup menu' : 'Buka menu'} aria-controls="public-mobile-navigation" aria-expanded={open} onClick={() => { setAccountMenuOpen(false); setOpen(!open); }}>{open ? <X size={20} strokeWidth={1.6} aria-hidden="true" /> : <Menu size={20} strokeWidth={1.6} aria-hidden="true" />}</button>
    </div>
  </div>{open && <nav id="public-mobile-navigation" className="container header-mobile-nav" aria-label="Navigasi seluler">
    <Link onClick={() => { setOpen(false); setAccountMenuOpen(false); }} href="/market" aria-current={active('/market')}>Market</Link><Link onClick={() => { setOpen(false); setAccountMenuOpen(false); }} href="/cara-kerja" aria-current={active('/cara-kerja')}>Cara kerja</Link><Link onClick={() => { setOpen(false); setAccountMenuOpen(false); }} href="/impact" aria-current={active('/impact')}>Impact</Link>
    {!signedIn && <Link onClick={() => setOpen(false)} href="/masuk">Masuk</Link>}
    <Link onClick={() => setOpen(false)} href={signedIn ? "/app" : "/daftar"}>{signedIn ? "Ringkasan akun" : "Mulai sekarang"}</Link>
  </nav>}</header>;
}
