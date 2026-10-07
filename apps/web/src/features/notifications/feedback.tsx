'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

// Lives inside the session cache scope so feedback survives navigation, but not logout.
export function NotificationFeedback() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const show = (event: Event) => setMessage((event as CustomEvent<string>).detail);
    window.addEventListener('valora-notification-feedback', show);
    return () => window.removeEventListener('valora-notification-feedback', show);
  }, []);
  if (!message) return null;
  return <div className="notification-feedback" role="alert"><div>{message}<Link href="/app/notifikasi" onClick={() => setMessage('')}>Buka pusat notifikasi</Link></div><button type="button" aria-label="Tutup pemberitahuan" onClick={() => setMessage('')}><X size={18} aria-hidden="true" /></button></div>;
}
