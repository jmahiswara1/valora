'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { UserDto } from '@valora/contracts';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Notice } from '@/components/ui/primitives';

export function PublicProfileSettings({ user }: { user: UserDto }) {
  const cache = useQueryClient(), session = useSession(), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  return <section className="profile-public-settings"><h3>Profil publik</h3><p>Nama, kota, barang aktif, dan ulasanmu dapat dilihat pengunjung Valora.</p><Link className="button button-secondary" href={`/profil/${user.id}`}>Lihat profil publik <ArrowUpRight size={16} aria-hidden="true" /></Link><label className="public-photo-setting"><input type="checkbox" checked={Boolean(user.profilePhotoPublic)} disabled={busy} onChange={async event => {
    if (busy) return; const value = event.target.checked; setBusy(true); setError(''); setSaved(false);
    try { const updated = await api<UserDto>('/me', { method: 'PATCH', body: { profilePhotoPublic: value } }); cache.setQueryData(['me'], updated); await session.refresh(); await cache.invalidateQueries({ queryKey: ['public-profile'] }); setSaved(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Pengaturan belum tersimpan. Coba lagi.'); }
    finally { setBusy(false); }
  }} /><span>Tampilkan foto profil ke publik<small>Foto juga tampil bersama ulasanmu. Saat nonaktif, pengunjung melihat inisial.</small></span></label>{busy && <p role="status">Menyimpan pengaturan…</p>}{saved && <p role="status">Pengaturan foto publik tersimpan.</p>}{error && <Notice kind="error">{error}</Notice>}</section>;
}
