import { Injectable } from '@nestjs/common';
import type { ReviewCreateInput, ReviewReplyInput, ReviewVisibilityInput, TransactionReviewsDto } from '@valora/contracts';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { AppException } from '../../shared/http.js';
import { idempotent, participant, serial, validId } from '../../shared/transactions.js';
import { OperationsService } from '../operations/service.js';
import { audit } from '../operations/helpers.js';
import { notify } from '../notifications/events.js';
import { personSelect, publicPerson, reviewInclude, reviewDto, reviewVisible } from './shared.js';
import type { Prisma, Transaction } from '../../generated/prisma/client.js';

const day = 86400000;
type Context = Prisma.TransactionGetPayload<{ include: { sellerOrDonor: { select: typeof personSelect }; buyerOrRecipient: { select: typeof personSelect }; reviews: { include: typeof reviewInclude }; corrections: true } }>;
const contextInclude = { sellerOrDonor: { select: personSelect }, buyerOrRecipient: { select: personSelect }, reviews: { include: reviewInclude }, corrections: true } satisfies Prisma.TransactionInclude;
function targetId(row: Transaction, actorId: string) { return row.type === 'EXCHANGE' ? (actorId === row.sellerOrDonorId ? row.buyerOrRecipientId : row.sellerOrDonorId) : actorId === row.buyerOrRecipientId ? row.sellerOrDonorId : null; }
function eligibility(row: Context, actorId: string): TransactionReviewsDto['eligibility'] {
  const target = targetId(row, actorId), deadline = row.completedAt ? new Date(row.completedAt.getTime() + 30 * day) : null;
  const reason = !target ? 'Hanya pembeli atau penerima barang yang dapat mengulas transaksi ini.' : row.status !== 'COMPLETED' ? 'Ulasan tersedia setelah transaksi selesai.' : row.correctedAt ? 'Transaksi ini telah dikoreksi.' : row.corrections.some(c => ['OPEN', 'IN_REVIEW', 'BLOCKED'].includes(c.status)) ? 'Transaksi sedang ditinjau melalui kasus koreksi.' : row.sellerOrDonor.status !== 'ACTIVE' || row.buyerOrRecipient.status !== 'ACTIVE' ? 'Akun peserta tidak tersedia.' : row.reviews.some(r => r.authorId === actorId) ? 'Ulasan sudah dikirim.' : !deadline || new Date() >= deadline ? 'Batas waktu 30 hari untuk mengulas telah berakhir.' : null;
  return { canReview: reason === null, reason, deadlineAt: deadline?.toISOString() ?? null, target: target ? publicPerson(target === row.sellerOrDonorId ? row.sellerOrDonor : row.buyerOrRecipient) : null };
}

@Injectable()
export class ReviewsService {
  constructor(private readonly db: DatabaseService, private readonly operations: OperationsService) {}
  async transaction(actorId: string, id: string): Promise<TransactionReviewsDto> {
    validId(id);
    return serial(this.db, async tx => {
      const row = await tx.transaction.findUnique({ where: { id }, include: contextInclude });
      if (!row) throw new AppException(404, 'NOT_FOUND', 'Transaksi tidak ditemukan.');
      participant(row, actorId);
      const eligible = eligibility(row, actorId), actor = await tx.user.findUniqueOrThrow({ where: { id: actorId }, select: { emailVerifiedAt: true } });
      if (!actor.emailVerifiedAt && eligible.canReview) { eligible.canReview = false; eligible.reason = 'Verifikasi email sebelum mengirim ulasan.'; }
      return { transactionVersion: row.version, eligibility: eligible, reviews: row.reviews.map(r => reviewDto(r, r.authorId === actorId)) };
    });
  }
  async create(actorId: string, id: string, input: ReviewCreateInput, key?: string) {
    validId(id);
    return idempotent(this.db, actorId, 'review-create:' + id, key, input, async tx => {
      const row = await tx.transaction.findUnique({ where: { id }, include: contextInclude });
      if (!row) throw new AppException(404, 'NOT_FOUND', 'Transaksi tidak ditemukan.');
      participant(row, actorId); await this.verified(tx, actorId);
      if (row.version !== input.expectedTransactionVersion) throw new AppException(409, 'STATE_CONFLICT', 'Transaksi sudah berubah. Muat ulang sebelum mengulas.');
      const eligible = eligibility(row, actorId);
      if (!eligible.canReview || !eligible.target) throw new AppException(409, 'REVIEW_INELIGIBLE', eligible.reason ?? 'Transaksi tidak dapat diulas.');
      const review = await tx.review.create({ data: { transactionId: id, authorId: actorId, subjectId: eligible.target.id, rating: input.rating, comment: input.comment?.trim() || null }, include: reviewInclude });
      await notify(tx, 'REVIEW_RECEIVED', `review:${review.id}:received`, [review.subjectId], { transactionId: id, title: 'Ulasan transaksi' });
      return reviewDto(review, true);
    });
  }
  async reply(actorId: string, id: string, input: ReviewReplyInput, key?: string) {
    validId(id);
    return idempotent(this.db, actorId, 'review-reply:' + id, key, input, async tx => {
      await this.verified(tx, actorId);
      const row = await tx.review.findUnique({ where: { id }, include: reviewInclude });
      if (!row || row.subjectId !== actorId) throw new AppException(404, 'NOT_FOUND', 'Ulasan tidak ditemukan.');
      if (row.version !== input.expectedReviewVersion || row.reply || !reviewVisible(row)) throw new AppException(409, 'STATE_CONFLICT', 'Ulasan sudah berubah atau telah dibalas.');
      await tx.reviewReply.create({ data: { reviewId: id, authorId: actorId, body: input.body } });
      const updated = await tx.review.update({ where: { id }, data: { version: { increment: 1 } }, include: reviewInclude });
      await notify(tx, 'REVIEW_REPLY_RECEIVED', `review:${id}:reply`, [row.authorId], { transactionId: row.transactionId, title: 'Balasan ulasan' });
      return reviewDto(updated, true);
    });
  }
  async visibility(adminId: string, id: string, kind: 'REVIEW' | 'REVIEW_REPLY', input: ReviewVisibilityInput, key?: string) {
    validId(id);
    return idempotent(this.db, adminId, `review-visibility:${kind}:${id}`, key, input, async tx => {
      await this.operations.requireGrant(tx, adminId, 'REPORT', input.reportId);
      const report = await tx.report.findUniqueOrThrow({ where: { id: input.reportId } });
      if (report.targetType !== kind || report.targetId !== id) throw new AppException(403, 'FORBIDDEN', 'Konten tidak terkait laporan.');
      const row = kind === 'REVIEW' ? await tx.review.findUnique({ where: { id } }) : await tx.reviewReply.findUnique({ where: { id } });
      if (!row || row.version !== input.expectedVersion || row.purgedAt) throw new AppException(409, 'STATE_CONFLICT', 'Konten sudah berubah atau dibersihkan.');
      const data = { visibility: input.visibility, version: { increment: 1 } };
      const updated = kind === 'REVIEW' ? await tx.review.update({ where: { id }, data }) : await tx.reviewReply.update({ where: { id }, data });
      await audit(tx, adminId, kind, id, 'SET_REVIEW_VISIBILITY', input.reason, { visibility: row.visibility }, { visibility: updated.visibility }, input.reportId);
      return { id, version: updated.version, visibility: updated.visibility };
    });
  }
  private async verified(tx: Prisma.TransactionClient, id: string) {
    const actor = await tx.user.findUniqueOrThrow({ where: { id }, select: { emailVerifiedAt: true } });
    if (!actor.emailVerifiedAt) throw new AppException(403, 'EMAIL_UNVERIFIED', 'Verifikasi email sebelum mengirim ulasan atau balasan.');
  }
}
