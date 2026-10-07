'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { Copy, Download, ExternalLink, QrCode, X } from 'lucide-react';
import type { PassportDto } from '@valora/contracts';
import { Button, Field, Input, Notice } from '@/components/ui/primitives';
import { usePassport } from './hooks';

const accessMessages = {
  PUBLIC: 'Passport ini dapat dibaca tanpa login. Hanya informasi publik barang yang ditampilkan.',
  LIMITED: 'Riwayat publik sedang dibatasi. QR ini membuka halaman status tanpa riwayat barang.',
  UNAVAILABLE: 'Passport publik belum tersedia. QR dapat disimpan sekarang; riwayat baru terbuka saat ada listing aktif atau transfer selesai, selama tidak disembunyikan.',
};

export function PassportQrButton({ itemId, owner = false, available = true }: { itemId: string; owner?: boolean; available?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="secondary" className="passport-qr-trigger" hidden={!available} onClick={() => setOpen(true)}><QrCode size={18} aria-hidden="true" />QR Passport</Button>
    {open && <PassportQrDialog itemId={itemId} owner={owner} onClose={() => setOpen(false)} />}
  </>;
}

function PassportQrDialog({ itemId, owner, onClose }: { itemId: string; owner: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const result = usePassport(itemId, owner);

  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (element?.open && !element.contains(document.activeElement)) element.querySelector<HTMLButtonElement>('button')?.focus();
  }, [result.isFetching, result.isError]);

  // A newly opened dialog waits for a fresh projection, including cached data.
  const ready = !result.isFetching && !result.isError && result.data;
  return <dialog ref={dialog} className="passport-qr-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]')).filter(node => node.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="passport-qr-heading"><div><span className="eyebrow">VALORA / PASSPORT</span><h2 id={titleId}>Riwayat dalam satu scan.</h2></div>
      <Button variant="quiet" className="passport-qr-close" aria-label="Tutup QR Passport" onClick={onClose} autoFocus><X size={20} aria-hidden="true" /></Button>
    </header>
    <p id={descriptionId} className="passport-qr-description">Bagikan perjalanan barang melalui Passport publiknya.</p>
    {result.isFetching || result.isPending ? <p className="passport-qr-loading" role="status">Memuat Passport…</p>
      : result.isError ? <Notice kind="error">Passport belum dapat diakses. <Button variant="quiet" onClick={() => void result.refetch()}>Coba lagi</Button></Notice>
        : ready && <PassportQrContent key={ready.share.url} data={ready} />}
  </dialog>;
}

function PassportQrContent({ data }: { data: PassportDto }) {
  const [png, setPng] = useState('');
  const [qrError, setQrError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [copying, setCopying] = useState(false);
  const linkInput = useRef<HTMLInputElement>(null);
  const copyPending = useRef(false);
  const mounted = useRef(true);
  const linkId = useId();
  const url = data.share.url;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname) || new URL(url).hostname.endsWith('.localhost');

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    import('qrcode').then(module => module.toDataURL(url, {
      width: 1024, margin: 4, errorCorrectionLevel: 'M', type: 'image/png',
      color: { dark: '#1B3A28FF', light: '#FFFFFFFF' },
    })).then(value => { if (active) setPng(value); }).catch(() => { if (active) setQrError(true); });
    return () => { active = false; };
  }, [url, attempt]);

  async function copyLink() {
    if (copyPending.current) return;
    copyPending.current = true;
    setCopying(true);
    setFeedback('');
    try {
      await navigator.clipboard.writeText(url);
      if (mounted.current) setFeedback('Tautan Passport disalin.');
    } catch {
      if (mounted.current) {
        linkInput.current?.focus();
        linkInput.current?.select();
        setFeedback('Salin otomatis belum tersedia. Pilih dan salin tautan di atas secara manual.');
      }
    } finally {
      copyPending.current = false;
      if (mounted.current) setCopying(false);
    }
  }

  return <div className="passport-qr-content">
    <div className="passport-qr-image">
      {png ? <Image src={png} alt="QR untuk membuka Passport publik barang" width={1024} height={1024} unoptimized />
        : qrError ? <div role="alert"><p>QR belum berhasil dibuat.</p><Button variant="secondary" onClick={() => { setQrError(false); setAttempt(value => value + 1); linkInput.current?.focus(); }}>Buat QR lagi</Button></div>
          : <p role="status">Membuat QR…</p>}
    </div>
    <p className="passport-qr-identity">ITEM {data.itemId}</p>
    <p className="passport-qr-access">{data.share.access === 'UNAVAILABLE' && data.visibility === 'HIDDEN'
      ? 'Passport publik sedang disembunyikan. QR tetap mengikuti barang, tetapi halaman publik belum dapat diakses.'
      : accessMessages[data.share.access]}</p>
    <Field label="Tautan Passport publik" htmlFor={linkId}><Input ref={linkInput} id={linkId} value={url} readOnly onFocus={event => event.currentTarget.select()} /></Field>
    {local && <p className="passport-qr-local">Tautan ini masih memakai alamat lokal dan hanya dapat dibuka di komputer ini. Agar bisa dipindai dari ponsel, alamat aplikasi perlu memakai domain publik atau alamat jaringan yang dapat dijangkau.</p>}
    <div className="passport-qr-actions"><Button variant="secondary" disabled={copying} onClick={() => void copyLink()}><Copy size={17} aria-hidden="true" />{copying ? 'Menyalin…' : 'Salin tautan'}</Button>
      {png ? <a className="button button-primary" href={png} download={`valora-passport-${data.itemId}.png`}><Download size={17} aria-hidden="true" />Unduh PNG</a>
        : <Button disabled><Download size={17} aria-hidden="true" />Unduh PNG</Button>}
    </div>
    <p className="passport-qr-feedback" role="status" aria-live="polite">{feedback}</p>
    <a className="passport-qr-open" href={url} target="_blank" rel="noopener noreferrer">Buka Passport publik<ExternalLink size={16} aria-hidden="true" /><span className="sr-only"> (tab baru)</span></a>
  </div>;
}
