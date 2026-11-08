'use client';

import Link from 'next/link';
import { Notice } from '@/components/ui/primitives';
import { useMe } from '@/lib/session';

export function ChatVerificationNotice() {
  const me = useMe();
  if (!me.data || me.data.emailVerifiedAt) return null;
  return <div className="chat-verification"><Notice>Alamat email belum diverifikasi. <Link href={`/verifikasi-email?email=${encodeURIComponent(me.data.email)}`}>Verifikasi email</Link> untuk mengirim pesan.</Notice></div>;
}
