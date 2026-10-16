'use client';

import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { TutorialSessionDto, TutorialInteractionDto } from '@valora/contracts';
import { Camera, ChevronDown, Send, Trash2 } from 'lucide-react';
import { api, apiEnvelope, ApiClientError } from '@/lib/api';
import { useMe } from '@/lib/session';
import { Button, Field, Input, Notice } from '@/components/ui/primitives';
import { TutorialPhoto, fail } from './shared';

export function TutorialQuestions({ session, stepId }: { session: TutorialSessionDto; stepId: string }) {
  const me = useMe(); const cache = useQueryClient(); const [question, setQuestion] = useState(''); const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState(''), [recoverId, setRecoverId] = useState(''); const running = useRef(false); const disclosure = useRef<HTMLDetailsElement>(null);
  const slot = `valora-tutorial-question:${me.data?.id ?? ''}:${session.id}`;
  useEffect(() => { const media = window.matchMedia('(min-width: 1200px)'); const sync = () => { if (disclosure.current) disclosure.current.open = media.matches; }; sync(); media.addEventListener('change', sync); return () => media.removeEventListener('change', sync); }, []);
  useEffect(() => { const saved = sessionStorage.getItem(slot); if (saved) queueMicrotask(() => setRecoverId(saved)); }, [slot]);
  const query = useInfiniteQuery({ queryKey: ['tutorial-questions', session.id], initialPageParam: '', queryFn: ({ pageParam }) => apiEnvelope<TutorialInteractionDto[]>(`/repair-tutorial-sessions/${session.id}/questions${pageParam ? '?cursor=' + pageParam : ''}`), getNextPageParam: p => p.meta?.nextCursor ?? undefined });
  async function refresh() { await Promise.all([cache.invalidateQueries({ queryKey: ['tutorial-questions', session.id] }), cache.invalidateQueries({ queryKey: ['tutorial-session', session.id] })]); }
  async function recover() {
    if (!recoverId || running.current) return; running.current = true; setBusy(true); setError('');
    try { const reply = await api<TutorialInteractionDto>(`/repair-tutorial-sessions/${session.id}/questions/by-request/${recoverId}`); if (reply.status !== 'PENDING') { sessionStorage.removeItem(slot); setRecoverId(''); } else setError('Pertanyaan masih diproses. Periksa kembali sebentar lagi.'); await refresh(); }
    catch (e) { if (e instanceof ApiClientError && e.status === 404) { sessionStorage.removeItem(slot); setRecoverId(''); } setError(fail(e)); }
    finally { running.current = false; setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file || uploading) return; setUploading(true); setError('');
    try {
      if (file.size > 8 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Pilih foto JPEG, PNG, atau WebP maksimal 8 MiB.');
      const ticket = await api<{ ticketId: string; uploadUrl: string }>(`/repair-tutorial-sessions/${session.id}/photos/tickets`, { method: 'POST', body: { fileName: file.name, mime: file.type, bytes: file.size, stepId } });
      await api(ticket.uploadUrl.replace('/api/v1', ''), { method: 'PUT', body: file });
      await api(`/repair-tutorial-sessions/${session.id}/photos/finalize`, { method: 'POST', body: { ticketId: ticket.ticketId, stepId } }); await refresh();
    } catch (e) { setError(fail(e)); } finally { setUploading(false); }
  }
  const turns = query.data?.pages.flatMap(p => p.data) ?? [];
  return <section className="tutorial-questions"><details ref={disclosure}><summary>Tanya tentang langkah ini <span>AI & foto opsional <ChevronDown className="tutorial-disclosure-arrow" size={16} aria-hidden="true" /></span></summary><div className="tutorial-question-content"><p className="muted">AI membantu memilih penjelasan dari panduan. Jawaban tidak memeriksa keberhasilan atau mengubah progresmu.</p>
    {error && <Notice kind="error">{error}</Notice>}{recoverId && <Notice>Hasil pertanyaan sebelumnya belum pasti. <Button type="button" variant="secondary" disabled={busy} onClick={() => void recover()}>Periksa jawaban sebelumnya</Button></Notice>}
    {session.capabilities.canAsk && <form className="form-stack" onSubmit={async e => { e.preventDefault(); if (running.current || recoverId) return; running.current = true; setBusy(true); setError(''); const requestId = crypto.randomUUID(); sessionStorage.setItem(slot, requestId); setRecoverId(requestId);
      try { const reply = await api<TutorialInteractionDto>(`/repair-tutorial-sessions/${session.id}/questions`, { method: 'POST', timeoutMs: 75000, body: { requestId, expectedVersion: session.version, stepId, question, photoIds: photoIds.filter(id => session.photos.some(p => p.id === id)).slice(0, 3) } }); if (reply.status !== 'PENDING') { sessionStorage.removeItem(slot); setRecoverId(''); } setQuestion(''); setPhotoIds([]); await refresh(); }
      catch (e) { if (e instanceof ApiClientError && e.status < 500) { sessionStorage.removeItem(slot); setRecoverId(''); } setError(fail(e)); } finally { running.current = false; setBusy(false); }
    }}><Field htmlFor="tutorial-question" label="Pertanyaanmu"><textarea id="tutorial-question" className="input" minLength={3} maxLength={1000} required rows={3} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Bagian mana yang belum jelas?" /></Field><p className="tutorial-disclosure">Saat dikirim, pertanyaan, keluhan awal, persiapan, konteks langkah, hingga 6 percakapan terkait, dan foto yang kamu pilih diproses layanan AI eksternal. Hindari data pribadi.</p>
      {!!session.photos.length && <fieldset className="tutorial-photo-selection"><legend>Pilih foto untuk pertanyaan ini · maksimal 3</legend>{session.photos.map((p, i) => <label key={p.id}><input type="checkbox" checked={photoIds.includes(p.id)} disabled={!photoIds.includes(p.id) && photoIds.length >= 3} onChange={e => setPhotoIds(ids => e.target.checked ? [...ids, p.id] : ids.filter(id => id !== p.id))} />Foto {i + 1} · {session.guide.steps.find(s => s.id === p.stepId)?.title ?? p.stepId}</label>)}</fieldset>}
      <Button type="submit" disabled={busy || uploading || Boolean(recoverId)}><Send size={16} aria-hidden="true" />{busy ? 'Memproses pertanyaan…' : 'Kirim pertanyaan'}</Button><small className="muted">Jika AI tidak tersedia, kamu tetap bisa mengikuti panduan dan menyimpan progres.</small></form>}
    <details className="tutorial-photo-disclosure"><summary><Camera size={17} aria-hidden="true" />Foto sesi · {session.photos.length}/12</summary><p className="muted">Foto hanya ada di sesi privat ini. Pilih secara terpisah jika ingin menjadikannya bukti catatan.</p>{session.capabilities.canAsk && <Field label={uploading ? 'Memproses foto…' : 'Tambahkan foto langkah ini'} htmlFor="tutorial-upload"><Input id="tutorial-upload" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || session.photos.length >= 12} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} /></Field>}<div className="tutorial-photos">{session.photos.map(p => <div key={p.id}><TutorialPhoto id={p.id} stepId={p.stepId} />{!session.purgedAt && <Button type="button" variant="quiet" aria-label={'Hapus foto langkah ' + p.stepId} disabled={busy || uploading} onClick={async () => { try { await api('/repair-tutorial-photos/' + p.id, { method: 'DELETE' }); setPhotoIds(ids => ids.filter(id => id !== p.id)); await refresh(); } catch (e) { setError(fail(e)); } }}><Trash2 size={16} aria-hidden="true" />Hapus foto</Button>}</div>)}</div></details>
    <h3>Riwayat pertanyaan</h3>{query.isPending ? <p role="status">Memuat pertanyaan…</p> : query.error ? <Notice kind="error">Riwayat gagal dimuat. <Button variant="quiet" onClick={() => void query.refetch()}>Coba lagi</Button></Notice> : !turns.length ? <p className="muted">Belum ada pertanyaan. Kamu bisa langsung mengikuti langkah panduan.</p> : <ol className="tutorial-turns">{turns.map(t => <li key={t.id}><p className="tutorial-turn-question">{t.question}</p><small className="muted">{session.guide.steps.find(s => s.id === t.stepId)?.title ?? 'Langkah sebelumnya'} · {new Date(t.createdAt).toLocaleString('id-ID')}</small>{t.status === 'PENDING' ? <p role="status">Jawaban sedang diproses. <Button variant="quiet" onClick={() => { setRecoverId(t.requestId); sessionStorage.setItem(slot, t.requestId); }}>Periksa status</Button></p> : t.status === 'STALE' ? <p>Konteks berubah. Jawaban lama tidak diterapkan.</p> : t.reply?.source === 'UNAVAILABLE' ? <p>AI belum tersedia. Baca penjelasan dan kondisi berhenti pada langkah panduan. Kamu dapat mengirim pertanyaan baru saat siap.</p> : <><p className="muted">{t.reply?.source === 'AI' ? 'AI memilih penjelasan dari katalog' : 'Penjelasan katalog'}</p>{t.reply?.blocks.map(b => <p key={b.id}>{b.text}</p>)}{t.reply?.observations.map(o => <p key={o}>{o}</p>)}{t.reply?.questions.map(q => <p key={q}>{q}</p>)}</>}</li>)}</ol>}{query.hasNextPage && <Button type="button" variant="quiet" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Lihat pertanyaan sebelumnya</Button>}
  </div></details></section>;
}
