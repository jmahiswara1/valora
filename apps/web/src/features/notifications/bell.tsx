'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Bell, ArrowUpRight } from 'lucide-react';
import { useNotificationSummary } from './hooks';
import { useSession } from '@/lib/session';
import { NotificationRow } from './row';

export function NotificationBell({ appearance = 'public', onOpen }: { appearance?: 'public' | 'account'; onOpen?: () => void }) {
  const session = useSession(), query = useNotificationSummary(), pathname = usePathname();
  const [open, setOpen] = useState(false), id = useId();
  const container = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const count = !query.isError ? query.data?.unreadCount : undefined;
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  if (session.state !== 'AUTHENTICATED') return null;
  return <div className={`notification-bell notification-bell--${appearance}`} ref={container} onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className={appearance === 'public' ? 'header-icon-link header-notification-button' : 'account-icon-button'} aria-label={count === undefined ? 'Notifikasi, jumlah belum tersedia' : count ? `Notifikasi, ${count} belum dibaca` : 'Notifikasi'} title="Notifikasi" aria-expanded={open} aria-controls={id} aria-current={pathname === '/app/notifikasi' ? 'page' : undefined}
      onClick={() => { if (!open) { onOpen?.(); void query.refetch(); } setOpen(!open); }}><Bell size={19} strokeWidth={1.6} aria-hidden="true" />{count !== undefined && count > 0 && <span className="notification-badge" aria-hidden="true">{count > 99 ? '99+' : count}</span>}</button>
    {open && <div ref={panel} id={id} className="notification-popover" role="region" aria-label="Preview notifikasi" tabIndex={-1}>
      <div className="notification-popover-heading"><h2>Notifikasi</h2><span>{count === undefined ? 'Memeriksa aktivitas' : `${count} belum dibaca`}</span></div>
      {query.isError ? <div className="notification-preview-state" role="alert"><p>Notifikasi gagal dimuat.</p><button type="button" className="link-button" onClick={() => query.refetch()}>Coba lagi</button></div> : query.isPending ? <p className="notification-preview-state" role="status">Memuat notifikasi…</p> : query.data?.recent.length ? <ul className="notification-preview-list">{query.data.recent.map(row => <NotificationRow key={row.id} row={row} compact onNavigate={() => setOpen(false)} />)}</ul> : <div className="notification-preview-state"><Bell size={25} aria-hidden="true" /><p>Belum ada notifikasi.</p><small>Perkembangan penawaran dan transaksi akan muncul di sini.</small></div>}
      <Link className="notification-popover-footer" href="/app/notifikasi" onClick={() => setOpen(false)}>Lihat semua notifikasi <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>}
  </div>;
}
