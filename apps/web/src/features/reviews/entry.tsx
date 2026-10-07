'use client';
import { useState, useId } from 'react';
import Link from 'next/link';
import { Star, Flag } from 'lucide-react';
import type { ReviewDto } from '@valora/contracts';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { ProfileAvatar } from '@/features/profile/avatar';
import { Button, Field, Notice } from '@/components/ui/primitives';
import { SearchDialog } from '@/features/searches/dialog';

export function RatingStars({ rating }: { rating: number }) {
  return <span className="review-stars" aria-label={`${rating} dari 5 bintang`}>{[1, 2, 3, 4, 5].map(n => <Star key={n} size={17} strokeWidth={1.6} fill={n <= rating ? 'currentColor' : 'none'} aria-hidden="true" />)}</span>;
}
export function ReviewReport({ id, kind }: { id: string; kind: 'REVIEW' | 'REVIEW_REPLY' }) {
  const session = useSession(), controlId = useId();
  const [open, setOpen] = useState(false), [details, setDetails] = useState(''), [reason, setReason] = useState('PERSONAL_DATA'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(false);
  if (session.state !== 'AUTHENTICATED' || !session.session?.user?.emailVerifiedAt) return null;
  return <><button type="button" className="review-report-trigger" aria-label={kind === 'REVIEW' ? 'Laporkan ulasan' : 'Laporkan balasan'} onClick={() => setOpen(true)}><Flag size={16} aria-hidden="true" />Laporkan</button>{open && <SearchDialog title={kind === 'REVIEW' ? 'Laporkan ulasan' : 'Laporkan balasan'} description="Jelaskan konten yang perlu ditinjau. Alasan laporan hanya dibaca oleh admin yang berhak." onClose={() => { if (!busy) setOpen(false); }}><form className="form-stack" onSubmit={async event => {
    event.preventDefault(); if (busy || sent) return; setBusy(true); setError('');
    try { await api('/reports', { method: 'POST', body: { targetType: kind, targetId: id, reasonCode: reason, details: details.trim() } }); setSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Laporan belum terkirim. Coba lagi.'); }
    finally { setBusy(false); }
  }}><fieldset disabled={busy || sent} className="form-stack"><Field label="Alasan laporan" htmlFor={controlId}><select className="input" id={controlId} value={reason} onChange={e => setReason(e.target.value)}><option value="PERSONAL_DATA">Memuat data pribadi</option><option value="HARASSMENT">Pelecehan atau ancaman</option><option value="SPAM">Spam atau tidak relevan</option><option value="OTHER">Alasan lainnya</option></select></Field><Field label="Penjelasan" htmlFor={controlId + '-details'}><textarea className="textarea" id={controlId + '-details'} value={details} required minLength={5} maxLength={1000} onChange={e => setDetails(e.target.value)} /></Field></fieldset>{error && <Notice kind="error">{error}</Notice>}{sent ? <Notice kind="success">Laporan terkirim untuk ditinjau admin.</Notice> : <Button disabled={busy || details.trim().length < 5}>{busy ? 'Mengirim…' : 'Kirim laporan'}</Button>}</form></SearchDialog>}</>;
}
export function ReviewEntry({ row, subjectName, children }: { row: ReviewDto; subjectName?: string; children?: React.ReactNode }) {
  const session = useSession(), user = session.state === 'AUTHENTICATED' ? session.session?.user : null;
  const type = { RESELL: 'Jual kembali', EXCHANGE: 'Tukar barang', DONATE: 'Donasi' }[row.type];
  return <article className="review-entry" id={'ulasan-' + row.id}>
    <header className="review-entry-header"><Link className="review-author" href={`/profil/${row.author.id}`}><ProfileAvatar photoUrl={row.author.profilePhotoUrl} displayName={row.author.displayName} /><strong>{row.author.displayName}</strong></Link><time dateTime={row.createdAt}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(row.createdAt))}</time></header>
    {row.visibility === 'VISIBLE' ? <><div className="review-entry-rating"><RatingStars rating={row.rating} /><span>{type} · Transaksi selesai</span></div>{row.comment ? <p className="review-comment">{row.comment}</p> : <p className="review-no-comment">Penilaian tanpa komentar.</p>}{row.reply && <div className="review-reply"><strong>Balasan {subjectName ?? 'penerima ulasan'}</strong>{row.reply.visibility === 'VISIBLE' && row.reply.body ? <p>{row.reply.body}</p> : <p>Balasan tidak tersedia.</p>}{user && user.id !== row.subjectId && row.reply.visibility === 'VISIBLE' && <ReviewReport key={`${user.id}:${row.reply.id}`} id={row.reply.id} kind="REVIEW_REPLY" />}</div>}{user && user.id !== row.author.id && <ReviewReport key={`${user.id}:${row.id}`} id={row.id} kind="REVIEW" />}{children}</> : <p className="review-no-comment">Ulasan ini tidak ditampilkan publik.</p>}
  </article>;
}
