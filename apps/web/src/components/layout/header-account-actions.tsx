'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { CircleUserRound, Heart, LayoutDashboard, LogOut, ShoppingCart } from 'lucide-react';
import { useSession } from '@/lib/session';
import { ChatTrigger } from '@/features/conversations/trigger';
import { NotificationBell } from '@/features/notifications/bell';

export function HeaderAccountActions({ open, onOpenChange, onInteract, context = 'public' }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInteract?: () => void;
  context?: 'public' | 'account';
}) {
  const session = useSession(), pathname = usePathname();
  const signedIn = session.state === 'AUTHENTICATED', user = signedIn ? session.session?.user : null;
  const trigger = useRef<HTMLButtonElement>(null), container = useRef<HTMLDivElement>(null);
  const menuId = context === 'account' ? 'account-user-menu' : 'header-account-menu';
  const active = (href: string) => pathname === href || pathname.startsWith(href + '/') ? 'page' as const : undefined;
  const accountHref = (href: string) => signedIn ? href : '/masuk?next=' + encodeURIComponent(href);
  const close = () => { onOpenChange(false); onInteract?.(); };

  useEffect(() => { onOpenChange(false); }, [pathname, signedIn, user?.id, onOpenChange]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onOpenChange(false); trigger.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) onOpenChange(false);
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside); };
  }, [open, onOpenChange]);

  return <nav className="header-icon-nav" aria-label="Akun dan aktivitas">
    {signedIn && <>
      <ChatTrigger onOpen={close} />
      <NotificationBell onOpen={close} />
      <Link className="header-icon-link header-activity-link" href="/app/penawaran" prefetch={false} aria-label="Penawaran saya" title="Penawaran saya" aria-current={active('/app/penawaran')} onClick={close}><ShoppingCart size={19} strokeWidth={1.6} aria-hidden="true" /></Link>
    </>}
    <Link className="header-icon-link header-favorite-link" href={accountHref('/app/favorit')} prefetch={false} aria-label="Favorit" title="Favorit" aria-current={active('/app/favorit')} onClick={close}><Heart size={19} strokeWidth={1.6} aria-hidden="true" /></Link>
    <div className="header-account" ref={container} onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) onOpenChange(false); }}>
      <button ref={trigger} className="header-icon-link header-account-trigger" type="button" aria-label="Menu akun" title="Menu akun" aria-expanded={open} aria-controls={menuId} onClick={() => { onInteract?.(); onOpenChange(!open); }}><CircleUserRound size={19} strokeWidth={1.6} aria-hidden="true" /></button>
      <div id={menuId} className="header-account-popover" role="group" aria-label="Menu akun" hidden={!open}>
        {signedIn ? <>
          <div className="account-menu-identity"><strong>{user?.displayName ?? 'Akun Valora'}</strong>{user?.email && <span>{user.email}</span>}</div>
          <div className="account-menu-actions">
            <Link href="/app" onClick={close}><LayoutDashboard size={17} aria-hidden="true" />Ringkasan</Link>
            <Link href="/app/profil" onClick={close}><CircleUserRound size={17} aria-hidden="true" />Profil saya</Link>
            <button type="button" disabled={session.logoutBusy} onClick={() => { close(); void session.logout(); }}><LogOut size={17} aria-hidden="true" />{session.logoutBusy ? 'Keluar…' : 'Keluar'}</button>
          </div>
        </> : <>
          <div className="account-menu-identity"><strong>Akun Valora</strong><span>Masuk atau buat akun untuk mengelola profil dan barangmu.</span></div>
          <div className="account-menu-actions"><Link href="/masuk" onClick={close}>Masuk</Link><Link href="/daftar" onClick={close}>Daftar</Link></div>
        </>}
      </div>
    </div>
  </nav>;
}
