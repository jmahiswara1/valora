'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Maximize2, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { TutorialState } from '@valora/contracts';

export const stateLabels: Record<TutorialState, string> = { PREFLIGHT: 'Persiapan', IN_PROGRESS: 'Sedang dikerjakan', PAUSED: 'Dijeda', BLOCKED: 'Perlu dihentikan', REVIEW: 'Tinjau hasil', RECORDED: 'Sudah dicatat', STOPPED: 'Ditutup tanpa catatan', INVALIDATED: 'Kondisi barang berubah' };
export const kindLabel = (kind: string) => kind === 'MAINTENANCE' ? 'Perawatan' : 'Perbaikan';
export const fail = (e: unknown) => e instanceof Error ? e.message : 'Koneksi gagal. Coba lagi.';
export function EnlargeImage({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  const [open, setOpen] = useState(false); const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (!open) return; const el = dialog.current; const trigger = document.activeElement as HTMLElement; el?.showModal(); return () => { el?.close(); trigger?.focus({ preventScroll: true }); }; }, [open]);
  return <figure className="tutorial-figure"><button type="button" className="tutorial-image-button" onClick={() => setOpen(true)} aria-label={'Perbesar gambar: ' + alt}>
    {/* Original diagrams and private signed photos do not use the image proxy. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={alt} /><span><Maximize2 size={16} aria-hidden="true" /> Perbesar</span>
  </button><figcaption>{caption}</figcaption>{open && <dialog ref={dialog} className="tutorial-image-dialog" aria-label={alt} onCancel={e => { e.preventDefault(); setOpen(false); }}><button type="button" className="account-icon-button" onClick={() => setOpen(false)} aria-label="Tutup gambar"><X size={22} /></button>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={alt} /><p>{caption}</p></dialog>}</figure>;
}
export function TutorialPhoto({ id, stepId }: { id: string; stepId: string }) {
  const [url, setUrl] = useState(''); const [error, setError] = useState(false);
  useEffect(() => { let alive = true; async function load() { try { const v = await api<{ url: string }>(`/repair-tutorial-photos/${id}/access`); if (alive) { setUrl(v.url); setError(false); } } catch { if (alive) setError(true); } } void load(); const timer = setInterval(() => void load(), 240000); return () => { alive = false; clearInterval(timer); }; }, [id]);
  return url && !error ? <EnlargeImage src={url} alt={`Foto privat langkah ${stepId}`} caption="Hanya kamu yang dapat melihat foto sesi ini." /> : <p className="muted"><Camera size={18} aria-hidden="true" />{error ? 'Foto tidak tersedia.' : 'Memuat foto…'}</p>;
}
