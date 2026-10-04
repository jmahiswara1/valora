'use client';

import Cropper, { type Area } from 'react-easy-crop';
import { ApiClientError, api } from '@/lib/api';
import type { UserDto } from '@valora/contracts';
import { useSession } from '@/lib/session';
import { useRef, useState, useEffect, type ChangeEvent } from 'react';
import { ProfileAvatar } from './avatar';
import { Notice, Button } from "../../components/ui/primitives";

const maxSourceBytes = 8 * 1024 * 1024;

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function cropToWebp(sourceUrl: string, area: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('Browser tidak dapat memproses foto.'));
      context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, 512, 512);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Foto gagal diproses menjadi WebP.')), 'image/webp', 0.9);
    };
    image.onerror = () => reject(new Error('Foto tidak dapat dibuka. Pilih berkas gambar lain.'));
    image.src = sourceUrl;
  });
}

function message(error: unknown) { return error instanceof ApiClientError ? error.message : error instanceof Error ? error.message : 'Koneksi gagal. Coba lagi.'; }

export function ProfilePhotoEditor({ user }: { user: UserDto }) {
  const session = useSession();
  const input = useRef<HTMLInputElement>(null);
  const migrationStarted = useRef<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropArea, setCropArea] = useState<Area | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [migrationFailed, setMigrationFailed] = useState(false);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);

  useEffect(() => {
    if (!user.profilePhotoMigrationAvailable || !user.profilePhotoUrl || migrationStarted.current === user.profilePhotoUrl) return;
    migrationStarted.current = user.profilePhotoUrl;
    setBusy(true);
    void api<UserDto>('/me/profile-photo/migrate', { method: 'POST' })
      .then(async () => { setMigrationFailed(false); setStatus('Foto profil lokal berhasil dipindahkan ke Cloudinary.'); await session.refresh(); })
      .catch((cause) => { setMigrationFailed(true); setError(message(cause)); })
      .finally(() => setBusy(false));
  }, [user.profilePhotoMigrationAvailable, user.profilePhotoUrl, session]);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setError(''); setStatus('');
    if (!file) return;
    if (!acceptedTypes.has(file.type)) return setError('Pilih foto JPG, PNG, atau WebP.');
    if (file.size > maxSourceBytes) return setError('Ukuran foto maksimal 8 MB.');
    setSourceUrl(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 }); setZoom(1); setCropArea(null);
  }

  async function savePhoto() {
    if (!sourceUrl || !cropArea) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const blob = await cropToWebp(sourceUrl, cropArea);
      if (blob.size > 1024 * 1024) throw new Error('Hasil crop terlalu besar. Pilih area foto yang lebih kecil.');
      await api<UserDto>('/me/profile-photo', { method: 'PUT', body: blob });
      setSourceUrl(null); setMigrationFailed(false);
      setStatus('Foto profil berhasil disimpan.');
      await session.refresh();
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  async function removePhoto() {
    setBusy(true); setError(''); setStatus('');
    try {
      await api<UserDto>('/me/profile-photo', { method: 'DELETE' });
      setStatus('Foto profil dihapus.');
      await session.refresh();
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  async function retryMigration() {
    setBusy(true); setError(''); setStatus('');
    try {
      await api<UserDto>('/me/profile-photo/migrate', { method: 'POST' });
      setMigrationFailed(false); setStatus('Foto profil berhasil dipindahkan ke Cloudinary.');
      await session.refresh();
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  const hasPhoto = user.profilePhotoProvider !== null;
  return <section className="profile-photo-editor" aria-labelledby="profile-photo-title">
    <div className="profile-photo-current"><ProfileAvatar photoUrl={user.profilePhotoUrl} displayName={user.displayName} className="profile-avatar-large" /><div><h3 id="profile-photo-title">Foto profil</h3><p>Foto tampil di akun dan percakapanmu.</p></div></div>
    {user.profilePhotoProvider === 'LOCAL' && !user.profilePhotoMigrationAvailable && <p className="field-hint">Foto tersimpan dan tetap digunakan pada akunmu.</p>}
    {user.profilePhotoProvider === 'CLOUDINARY' && !user.profilePhotoUrl && <p className="field-hint">Foto profil belum dapat ditampilkan. Coba lagi nanti.</p>}
    {user.profilePhotoMigrationAvailable && <p className="field-hint">Foto lokal {migrationFailed ? 'belum dipindahkan.' : busy ? 'sedang dipindahkan ke Cloudinary.' : 'akan dipindahkan ke Cloudinary.'}</p>}
    {error && <Notice kind="error">{error}</Notice>}{status && <Notice kind="success">{status}</Notice>}
    {sourceUrl && <div className="profile-photo-crop-area"><div className="profile-photo-cropper"><Cropper image={sourceUrl} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_area, pixels) => setCropArea(pixels)} /></div><label className="profile-photo-zoom" htmlFor="profile-photo-zoom">Perbesar foto <input id="profile-photo-zoom" type="range" min={1} max={3} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label></div>}
    <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} aria-label="Pilih foto profil" />
    <div className="form-actions profile-photo-actions">
      {!sourceUrl ? <Button type="button" variant="secondary" disabled={busy} onClick={() => input.current?.click()}>{hasPhoto ? 'Ganti foto' : 'Pilih foto'}</Button> : <><Button type="button" disabled={busy || !cropArea} onClick={savePhoto}>{busy ? 'Menyimpan…' : 'Simpan foto'}</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => setSourceUrl(null)}>Batal</Button></>}
      {hasPhoto && !sourceUrl && <Button type="button" variant="quiet" disabled={busy} onClick={removePhoto}>Hapus foto</Button>}
      {user.profilePhotoMigrationAvailable && migrationFailed && !busy && <Button type="button" variant="quiet" onClick={retryMigration}>Coba migrasi lagi</Button>}
    </div>
    <p className="field-hint">JPG, PNG, atau WebP, maksimal 8 MB. Atur crop dan posisi sebelum disimpan.</p>
  </section>;
}
