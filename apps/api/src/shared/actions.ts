import { AppException } from './http.js';
import type { Prisma } from '../generated/prisma/client.js';
import { requestContext } from './request-context.js';

export async function requireRecentAuthentication(tx: Prisma.TransactionClient) {
  const actor = requestContext.getStore()?.actor;
  if (!actor) return; // Internal jobs/fixtures have no browser session.
  const session = await tx.session.findUnique({ where: { id: actor.sessionId } });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new AppException(401, 'UNAUTHENTICATED', 'Sesi sudah berakhir.');
  if (session.reauthenticatedAt.getTime() + 900000 <= Date.now()) throw new AppException(403, 'REAUTHENTICATION_REQUIRED', 'Verifikasi kata sandi sebelum melanjutkan.');
}
async function grant(tx: Prisma.TransactionClient, actorId: string, type: string, id: string, kind = 'EVIDENCE') {
  const row = type === 'DISPUTE' ? await tx.disputeCase.findUnique({ where: { id } }) : type === 'CORRECTION' ? await tx.correctionCase.findUnique({ where: { id } }) : await tx.report.findUnique({ where: { id } });
  if (!row || row.assignedAdminId !== actorId) throw new AppException(404, 'NOT_FOUND', 'Kasus tidak ditugaskan kepada akun ini.');
  const access = type === 'DISPUTE' ? await tx.caseAccessGrant.findFirst({ where: { caseId: id, adminId: actorId, kind: kind as 'EVIDENCE' | 'CHAT' | 'HANDOVER', expiresAt: { gt: new Date() } } }) : await tx.operationsAccessGrant.findFirst({ where: { scopeType: type, scopeId: id, adminId: actorId, expiresAt: { gt: new Date() } } });
  if (!access) throw new AppException(403, 'ACCESS_REASON_REQUIRED', 'Akses kasus berakhir. Perbarui alasan akses.');
}
export async function authorizeReplay(tx: Prisma.TransactionClient, actorId: string, operation: string, payload: unknown) {
  const [name, id, qualifier] = operation.split(':');
  const input = (payload ?? {}) as Record<string, string>;
  const user = await tx.user.findUnique({ where: { id: actorId } });
  if (!user || user.status !== 'ACTIVE') throw new AppException(403, 'ACCOUNT_SUSPENDED', 'Akun tidak dapat digunakan.');
  const member = ['handover-propose', 'handover-respond', 'handover-withdraw', 'shipment-update', 'accept', 'confirm', 'cash-confirm', 'cancel-request', 'cancel-respond', 'dispute', 'overdue-case', 'evidence', 'correction-open', 'correction-evidence', 'review-create', 'review-reply'].includes(name);
  if (!member && user.role !== 'ADMIN') throw new AppException(403, 'FORBIDDEN', 'Izin admin diperlukan.');
  if (['handover-propose', 'handover-respond', 'handover-withdraw', 'shipment-update', 'confirm', 'cash-confirm', 'cancel-request', 'cancel-respond', 'dispute', 'overdue-case', 'correction-open'].includes(name)) {
    const row = await tx.transaction.findUnique({ where: { id } });
    if (!row || ![row.sellerOrDonorId, row.buyerOrRecipientId].includes(actorId)) throw new AppException(404, 'NOT_FOUND', 'Transaksi tidak ditemukan.');
  }
  if (name === 'review-create' || name === 'review-reply') {
    if (!user.emailVerifiedAt) throw new AppException(403, 'EMAIL_UNVERIFIED', 'Verifikasi email sebelum melanjutkan.');
    const review = name === 'review-create' ? await tx.review.findUnique({ where: { transactionId_authorId: { transactionId: id, authorId: actorId } }, include: { transaction: true, subject: true, author: true } }) : await tx.review.findUnique({ where: { id }, include: { transaction: true, subject: true, author: true } });
    if (!review || (name === 'review-reply' && review.subjectId !== actorId) || review.purgedAt || review.transaction.correctedAt || review.transaction.status !== 'COMPLETED' || review.subject.status !== 'ACTIVE' || review.author.status !== 'ACTIVE') throw new AppException(404, 'NOT_FOUND', 'Ulasan tidak tersedia.');
  }
  if (name === 'review-visibility') await grant(tx, actorId, 'REPORT', input.reportId);
  if (name === 'accept') {
    const offer = await tx.offer.findUnique({ where: { id }, include: { listing: true } });
    if (!offer || ![offer.bidderId, offer.listing.ownerId].includes(actorId)) throw new AppException(404, 'NOT_FOUND', 'Penawaran tidak ditemukan.');
  }
  if (name === 'evidence') {
    const row = await tx.disputeCase.findUnique({ where: { id }, include: { transaction: true } });
    if (!row || ![row.transaction.sellerOrDonorId, row.transaction.buyerOrRecipientId].includes(actorId)) throw new AppException(404, 'NOT_FOUND', 'Kasus tidak ditemukan.');
  }
  if (name === 'correction-evidence') {
    const row = await tx.correctionCase.findUnique({ where: { id }, include: { transaction: true } });
    if (!row) throw new AppException(404, 'NOT_FOUND', 'Kasus tidak ditemukan.');
    if (![row.transaction.sellerOrDonorId, row.transaction.buyerOrRecipientId].includes(actorId)) await grant(tx, actorId, 'CORRECTION', id);
  }
  if (name === 'resolve') await grant(tx, actorId, 'DISPUTE', input.caseId);
  if (['ownership-correction', 'impact-adjust', 'source-correction'].includes(name)) await grant(tx, actorId, 'CORRECTION', input.caseId ?? id);
  if (name === 'correction-close') await grant(tx, actorId, 'CORRECTION', id);
  if (name === 'report-resolve') await grant(tx, actorId, 'REPORT', id);
  if (name === 'admin-listing') await grant(tx, actorId, 'REPORT', input.reportId);
  if (name === 'passport-visibility') await grant(tx, actorId, input.scopeType ?? 'REPORT', input.scopeId ?? input.caseId ?? input.reportId);
  if (['case-claim', 'correction-claim', 'report-claim'].includes(name)) {
    const row = name === 'case-claim' ? await tx.disputeCase.findUnique({ where: { id } }) : name === 'correction-claim' ? await tx.correctionCase.findUnique({ where: { id } }) : await tx.report.findUnique({ where: { id } });
    if (!row || row.assignedAdminId !== actorId) throw new AppException(404, 'NOT_FOUND', 'Penugasan sudah berubah.');
  }
  if (name === 'retention-hold') await grant(tx, actorId, input.scopeType, input.scopeId);
  if (name === 'case-access') await grant(tx, actorId, 'DISPUTE', id, qualifier);
  if (name === 'operations-grant') await grant(tx, actorId, id, qualifier);
}
