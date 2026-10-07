'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X, RotateCw } from 'lucide-react';
import type { MessageDto } from '@valora/contracts';
import { api, ApiClientError } from '@/lib/api';
import { Button, Notice } from '@/components/ui/primitives';

type DraftPhoto = { id: string; file: File; preview: string; state: 'uploading' | 'ready' | 'error'; ticketId?: string; error?: string };
type Intent = { clientMessageId: string; body: string; ticketIds: string[] };
export function ChatComposer({ id, onSent }: { id: string; onSent: () => Promise<void> }) {
  const [body, setBody] = useState(''), [photos, setPhotos] = useState<DraftPhoto[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const input = useRef<HTMLInputElement>(null), photoRef = useRef(photos), intent = useRef<Intent | null>(null), running = useRef(false), active = useRef(true);
  useEffect(() => { photoRef.current = photos; }, [photos]);
  useEffect(() => { active.current = true; return () => { active.current = false; for (const photo of photoRef.current) URL.revokeObjectURL(photo.preview); }; }, []);
  async function upload(photo: DraftPhoto) {
    setPhotos(rows => rows.map(row => row.id === photo.id ? { ...row, state: 'uploading', error: undefined } : row));
    try {
      const ticket = await api<{ ticketId: string; uploadUrl: string }>(`/conversations/${id}/photos/tickets`, { method: 'POST', body: { fileName: photo.file.name, bytes: photo.file.size, mime: photo.file.type, purpose: 'MESSAGE_ATTACHMENT' } });
      await api(ticket.uploadUrl.replace('/api/v1', ''), { method: 'PUT', body: photo.file });
      if (active.current) setPhotos(rows => rows.map(row => row.id === photo.id ? { ...row, state: 'ready', ticketId: ticket.ticketId } : row));
    } catch (cause) { if (active.current) setPhotos(rows => rows.map(row => row.id === photo.id ? { ...row, state: 'error', error: cause instanceof Error ? cause.message : 'Unggah gagal.' } : row)); }
  }
  function pick(files: FileList | null) {
    if (!files || busy || uncertain) return;
    const selected = [...files];
    if (photos.length + selected.length > 3) { setError('Maksimal tiga foto per pesan. Hapus foto sebelum menambah yang lain.'); return; }
    if (selected.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 8 * 1024 * 1024)) { setError('Gunakan JPG, PNG, atau WebP, maksimal 8 MiB per foto.'); return; }
    setError(''); intent.current = null;
    const additions: DraftPhoto[] = selected.map(file => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), state: 'uploading' }));
    setPhotos(rows => [...rows, ...additions]); additions.forEach(photo => { void upload(photo); });
  }
  async function committed() {
    if (!active.current) return;
    setBody(''); photos.forEach(photo => URL.revokeObjectURL(photo.preview)); setPhotos([]); intent.current = null; setUncertain(false); setError('');
    await onSent();
  }
  async function recover() {
    if (!intent.current || running.current) return;
    running.current = true; setBusy(true);
    try {
      const result = await api<{ committed: boolean; message: MessageDto | null }>(`/conversations/${id}/messages/status?clientMessageId=${intent.current.clientMessageId}`);
      if (result.committed) await committed();
      else { setUncertain(false); setError('Pesan belum tersimpan. Kamu dapat mengirim ulang draf ini.'); }
    } catch { setError('Status pesan belum dapat diperiksa. Draf tetap tersimpan di halaman ini. Coba periksa lagi.'); }
    finally { running.current = false; setBusy(false); }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (running.current || uncertain || photos.some(photo => photo.state !== 'ready') || (!body.trim() && !photos.length)) return;
    running.current = true; setBusy(true); setError('');
    intent.current ??= { clientMessageId: crypto.randomUUID(), body: body.trim(), ticketIds: photos.map(photo => photo.ticketId!) };
    try { await api<MessageDto>(`/conversations/${id}/messages`, { method: 'POST', body: intent.current }); await committed(); }
    catch (cause) {
      if (!active.current) return;
      if (!(cause instanceof ApiClientError) || cause.status >= 500) { setUncertain(true); setError('Respons kirim belum diterima. Periksa status sebelum mengirim ulang.'); }
      else setError(cause.message);
    } finally { running.current = false; setBusy(false); }
  }
  const locked = busy || uncertain;
  return <div className="chat-compose-area">{error && <Notice kind="error">{error}</Notice>}
    {uncertain && <Button type="button" variant="secondary" disabled={busy} onClick={recover}>{busy ? 'Memeriksa…' : 'Periksa status pesan'}</Button>}
    <form onSubmit={send} className="chat-photo-composer" aria-busy={busy}>
      {!!photos.length && <ul className="chat-draft-photos">{photos.map((photo, index) => <li key={photo.id}>
        {/* Local previews never leave this session's component. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.preview} alt={`Pratinjau foto ${index + 1}`} />
        <button type="button" className="chat-icon-button draft-remove" aria-label={`Hapus foto ${index + 1}`} disabled={locked} onClick={() => { URL.revokeObjectURL(photo.preview); setPhotos(rows => rows.filter(row => row.id !== photo.id)); intent.current = null; }}><X size={17} /></button>
        <span role="status">{photo.state === 'ready' ? 'Siap' : photo.state === 'uploading' ? 'Mengunggah…' : 'Unggah gagal'}</span>
        {photo.state === 'error' && <><small>{photo.error}</small><button type="button" className="chat-upload-retry" disabled={locked} onClick={() => upload(photo)}><RotateCw size={15} /> Coba lagi</button></>}
      </li>)}</ul>}
      <div className="chat-composer"><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1} aria-label="Pilih foto pesan" disabled={locked} onChange={event => { pick(event.target.files); event.target.value = ''; }} />
        <button type="button" className="chat-icon-button chat-add-photo" aria-label="Tambahkan foto" title="Tambahkan hingga tiga foto" disabled={locked || photos.length >= 3} onClick={() => input.current?.click()}><ImagePlus size={22} /></button>
        <label className="sr-only" htmlFor="message-body">Pesan</label><textarea id="message-body" value={body} disabled={locked} onChange={event => { setBody(event.target.value); intent.current = null; }} maxLength={2000} placeholder="Tulis pesan…" />
        <Button type="submit" disabled={locked || photos.some(photo => photo.state !== 'ready') || (!body.trim() && !photos.length)}>{busy ? 'Mengirim…' : 'Kirim'}</Button>
      </div><p className="chat-photo-hint">Hingga 3 foto · JPG, PNG, WebP · maks. 8 MiB per foto</p>
    </form>
  </div>;
}
