'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CityDto, UserDto } from '@valora/contracts';
import { api, ApiClientError } from '@/lib/api';
import { useMe, useSession } from '@/lib/session';
import { SessionManagement } from '@/features/profile/sessions';
import { CityPicker } from '@/components/ui/city-picker';
import { ProfilePhotoEditor } from '@/features/profile/photo-editor';
import { Button, Field, Input, Notice } from "@/components/ui/primitives";
import { AccountHeading } from '@/features/account/heading';
import { AccountPasswordInput } from '@/features/auth/password-input';

function errorMessage(error: unknown) { return error instanceof ApiClientError ? error.message : 'Koneksi gagal. Coba lagi.'; }
export default function Profile() {
  const session = useSession(); const me = useMe(); const cache = useQueryClient(); const router = useRouter();
  const [city, setCity] = useState<CityDto | null>(null); const [status, setStatus] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState(''); const [passwordError, setPasswordError] = useState('');
  const [closeError, setCloseError] = useState(''); const running = useRef(false);
  if (!me.data) return <div className="loading-line" />;
  const user = me.data;
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (running.current) return; setError(''); setStatus(''); const data = new FormData(event.currentTarget); if (city && !city.id) return setError('Pilih kota dari hasil pencarian.'); running.current = true; setBusy(true); try { const updated = await api<UserDto>('/me', { method: 'PATCH', body: { displayName: data.get('displayName'), email: data.get('email'), cityId: city?.id ?? user.city.id } }); cache.setQueryData(['me'], updated); await session.refresh(); setStatus(data.get('email') !== user.email ? 'Profil disimpan. Periksa email baru untuk memverifikasi perubahan alamat.' : 'Profil berhasil disimpan.'); } catch (e) { setError(errorMessage(e)); } finally { running.current = false; setBusy(false); } }
  async function changePassword(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (running.current) return; const passwordForm = event.currentTarget; setPasswordError(''); setPasswordStatus(''); const data = new FormData(event.currentTarget); if (data.get('newPassword') !== data.get('confirm')) return setPasswordError('Konfirmasi kata sandi tidak sama.'); running.current = true; setBusy(true); try { await api('/me/password', { method: 'PATCH', body: { currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword') } }); setPasswordStatus('Kata sandi berhasil diubah. Sesi di perangkat lain telah dicabut.'); passwordForm.reset(); } catch (e) { setPasswordError(errorMessage(e)); } finally { running.current = false; setBusy(false); } }
  async function closeAccount(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (running.current) return; const data = new FormData(event.currentTarget); if (data.get('confirmation') !== 'TUTUP') return setCloseError('Ketik TUTUP untuk mengonfirmasi.'); running.current = true; setBusy(true); setCloseError(''); try { await api('/me/close', { method: 'POST', body: { reason: String(data.get('reason') ?? '').trim() || undefined } }); cache.clear(); await session.changed(); router.replace('/'); } catch (e) { setCloseError(errorMessage(e)); } finally { running.current = false; setBusy(false); } }
  return <><AccountHeading title="Profil saya" description="Informasi akun, keamanan, dan perangkat yang terhubung." />
    <div className="account-profile-layout"><div className="account-profile-column"><section className="app-panel" aria-labelledby="profile-info"><h2 id="profile-info">Informasi akun</h2><p><span className="badge">{user.emailVerifiedAt ? 'Email terverifikasi' : 'Email belum diverifikasi'}</span></p><ProfilePhotoEditor user={user} />
      <form className="form-stack" onSubmit={save} aria-busy={busy}>{error && <Notice kind="error">{error}</Notice>}{status && <Notice kind="success">{status}</Notice>}<fieldset className="account-form-fields form-stack" disabled={busy}><Field label="Nama tampilan" htmlFor="displayName"><Input id="displayName" name="displayName" required minLength={2} maxLength={80} defaultValue={user.displayName} autoComplete="nickname" /></Field><Field label="Email" htmlFor="email" hint="Jika diubah, tautan verifikasi dikirim ke alamat baru."><Input id="email" name="email" type="email" required defaultValue={user.email} autoComplete="email" aria-describedby="email-hint" /></Field><CityPicker value={city?.id ?? user.city.id} initial={user.city} onChange={setCity} /></fieldset><div className="form-actions"><Button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan profil'}</Button></div></form>
    </section><section className="app-panel"><SessionManagement /></section></div>
    <div className="account-profile-column"><section className="app-panel" aria-labelledby="profile-security"><h2 id="profile-security">Ubah kata sandi</h2><p>Gunakan minimal 12 karakter. Setelah perubahan, sesi di perangkat lain akan dicabut.</p>
      <form className="form-stack" onSubmit={changePassword} aria-busy={busy}>{passwordError && <Notice kind="error">{passwordError}</Notice>}{passwordStatus && <Notice kind="success">{passwordStatus}</Notice>}<fieldset className="account-form-fields form-stack" disabled={busy}><Field label="Kata sandi saat ini" htmlFor="currentPassword"><AccountPasswordInput id="currentPassword" name="currentPassword" required autoComplete="current-password" /></Field><Field label="Kata sandi baru" htmlFor="newPassword"><AccountPasswordInput id="newPassword" name="newPassword" minLength={12} required autoComplete="new-password" /></Field><Field label="Ulangi kata sandi baru" htmlFor="confirm"><AccountPasswordInput id="confirm" name="confirm" minLength={12} required autoComplete="new-password" /></Field></fieldset><div className="form-actions"><Button variant="secondary" disabled={busy}>{busy ? 'Menyimpan…' : 'Ubah kata sandi'}</Button></div></form>
    </section><section className="app-panel account-danger-panel" aria-labelledby="profile-close"><h2 id="profile-close">Tutup akun</h2><p>Akun langsung dinonaktifkan dan seluruh sesi dicabut. Data pribadi dianonimkan setelah masa retensi 30 hari.</p>
      <form className="form-stack" onSubmit={closeAccount} aria-busy={busy}>{closeError && <Notice kind="error">{closeError}</Notice>}<fieldset className="account-form-fields form-stack" disabled={busy}><Field label="Alasan (opsional)" htmlFor="reason"><textarea className="textarea" id="reason" name="reason" maxLength={500} /></Field><Field label="Ketik TUTUP untuk mengonfirmasi" htmlFor="confirmation"><Input id="confirmation" name="confirmation" required autoComplete="off" /></Field></fieldset><div className="form-actions"><Button variant="danger" disabled={busy}>{busy ? 'Memproses…' : 'Tutup akun saya'}</Button></div></form>
    </section></div></div>
  </>;
}
