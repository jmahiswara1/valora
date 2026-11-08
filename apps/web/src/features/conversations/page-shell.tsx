'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SiteHeader } from '@/components/layout/header';
import { Button, Notice } from '@/components/ui/primitives';
import { useSession } from '@/lib/session';
import { ChatVerificationNotice } from './verification';

export function ChatPageShell({ children }: { children: ReactNode }) {
  const session = useSession(), pathname = usePathname(), router = useRouter();
  useEffect(() => { if (session.state === 'GUEST') router.replace('/masuk?next=' + encodeURIComponent(pathname)); }, [session.state, pathname, router]);
  let content: ReactNode;
  if (session.state === 'LOGOUT_PENDING') content = <div className="chat-access-state"><Notice>Permintaan keluar belum terkonfirmasi. Data privat disembunyikan.</Notice><Button disabled={session.logoutBusy} onClick={() => session.logout()}>Coba keluar lagi</Button></div>;
  else if (session.state === 'RESTRICTED') content = <div className="chat-access-state"><Notice kind="error">Akun ini tidak dapat digunakan.</Notice><Button onClick={() => session.logout()}>Keluar</Button></div>;
  else if (session.state === 'UNAVAILABLE') content = <div className="chat-access-state"><Notice kind="error">Koneksi sesi belum tersedia.</Notice><Button onClick={() => session.refresh()}>Coba lagi</Button></div>;
  else if (session.state !== 'AUTHENTICATED' || session.verifiedPath !== pathname) content = <div className="chat-access-state" role="status">Menyiapkan percakapan…</div>;
  else content = <main id="main-content" className="chat-surface" tabIndex={-1}><ChatVerificationNotice />{children}</main>;
  return <div className="messages-shell"><div className="messages-header valora-surface"><a className="public-skip-link" href="#main-content">Langsung ke konten</a><SiteHeader appearance="renewed" /></div><div className="messages-page-toolbar"><Link href="/market" className="back-link"><ArrowLeft size={17} aria-hidden="true" />Kembali ke Market</Link><span>Percakapan Valora</span></div>{content}</div>;
}
