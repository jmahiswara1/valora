'use client';
import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import type { ReviewDto, TransactionReviewsDto } from '@valora/contracts';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useCriticalAction } from '@/hooks/use-critical-action';
import { ActionFeedback } from '@/components/ui/action-feedback';
import { Button, Field, Notice } from '@/components/ui/primitives';
import { ReviewEntry } from './entry';

function ReplyForm({ row, actorId }: { row: ReviewDto; actorId: string }) {
  const [body, setBody] = useState(''), [open, setOpen] = useState(false), id = useId();
  const action = useCriticalAction('review-reply:' + row.id, actorId);
  if (row.reply || row.subjectId !== actorId || row.visibility !== 'VISIBLE') return null;
  return <div className="review-reply-form">{!open ? <Button variant="secondary" type="button" onClick={() => setOpen(true)}>Balas ulasan</Button> : <form className="form-stack" onSubmit={async e => { e.preventDefault(); await action.run(`/reviews/${row.id}/reply`, { expectedReviewVersion: row.version, body: body.trim() }); }}><Field label="Balasanmu" htmlFor={id} hint="Balasan tampil publik dan tidak dapat diedit setelah dikirim."><textarea className="textarea" id={id} required maxLength={1000} value={body} disabled={action.pending || action.hasSaved()} onChange={e => setBody(e.target.value)} /></Field><div className="form-actions"><Button disabled={action.pending || action.hasSaved() || !body.trim()}>{action.pending ? 'Mengirim…' : 'Kirim balasan'}</Button><Button type="button" variant="quiet" disabled={action.pending} onClick={() => setOpen(false)}>Kembali</Button></div></form>}<ActionFeedback action={action} /></div>;
}
function ReviewForm({ data, transactionId, actorId }: { data: TransactionReviewsDto; transactionId: string; actorId: string }) {
  const [rating, setRating] = useState(0), [comment, setComment] = useState(''), id = useId();
  const action = useCriticalAction('review-create:' + transactionId, actorId);
  return <form className="form-stack review-form" onSubmit={async e => { e.preventDefault(); if (!rating) return; await action.run(`/transactions/${transactionId}/reviews`, { expectedTransactionVersion: data.transactionVersion, rating, ...(comment.trim() ? { comment: comment.trim() } : {}) }); }}>
    <h3>Bagaimana pengalamanmu dengan {data.eligibility.target?.displayName}?</h3><p>Ulasan tampil publik dengan nama profilmu dan tidak dapat diedit setelah dikirim. Hindari membagikan kontak atau alamat pribadi.</p>
    <fieldset className="review-rating-field" disabled={action.pending || action.hasSaved()}><legend>Rating pengalaman transaksi</legend><div className="review-rating-input">{[1, 2, 3, 4, 5].map(n => <label key={n} className={n <= rating ? 'is-selected' : ''}><input type="radio" name={id} value={n} checked={rating === n} required aria-label={`${n} bintang`} onChange={() => setRating(n)} /><Star size={26} strokeWidth={1.6} fill={n <= rating ? 'currentColor' : 'none'} aria-hidden="true" /></label>)}</div><span className="review-rating-description" aria-live="polite">{rating ? `${rating} dari 5 bintang` : 'Pilih 1–5 bintang'}</span></fieldset>
    <Field label="Komentar (opsional)" htmlFor={id + '-comment'}><textarea className="textarea" id={id + '-comment'} maxLength={1000} value={comment} disabled={action.pending || action.hasSaved()} onChange={e => setComment(e.target.value)} /></Field><small>{comment.length}/1.000 karakter{data.eligibility.deadlineAt && ` · Kirim sebelum ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.eligibility.deadlineAt))}`}</small><div className="form-actions"><Button disabled={!rating || action.pending || action.hasSaved()}>{action.pending ? 'Mengirim…' : 'Kirim ulasan'}</Button></div><ActionFeedback action={action} />
  </form>;
}
function TransactionReviewsContent({ id, actorId }: { id: string; actorId: string }) {
  const session = useSession();
  const query = useQuery({ queryKey: ['transaction-reviews', actorId, id], queryFn: () => api<TransactionReviewsDto>(`/transactions/${id}/reviews`), refetchInterval: 10000, retry: false });
  const data = query.data;
  return <section className="app-panel transaction-reviews" aria-labelledby="transaction-reviews-title"><h2 id="transaction-reviews-title">Ulasan transaksi</h2>{query.isPending ? <p role="status">Memuat ulasan…</p> : query.isError ? <Notice kind="error">Ulasan belum dapat dimuat. <Button variant="quiet" onClick={() => query.refetch()}>Coba lagi</Button></Notice> : data && <>
    {data.eligibility.canReview ? <ReviewForm data={data} transactionId={id} actorId={actorId} /> : <p className="review-eligibility">{data.eligibility.reason}</p>}
    {data.reviews.map(row => <ReviewEntry key={row.id} row={row} subjectName={row.subjectId === actorId ? session.session?.user?.displayName : data.eligibility.target?.displayName}>{session.session?.user?.emailVerifiedAt && <ReplyForm row={row} actorId={actorId} />}</ReviewEntry>)}
  </>}</section>;
}
export function TransactionReviews({ id }: { id: string }) {
  const session = useSession(), userId = session.session?.user?.id;
  if (session.state !== 'AUTHENTICATED' || !userId) return null;
  return <TransactionReviewsContent key={`${id}:${userId}`} id={id} actorId={userId} />;
}
