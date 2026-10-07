import type { Prisma } from '../../generated/prisma/client.js';
import { validId, participant } from '../../shared/transactions.js';
import { AppException } from '../../shared/http.js';
import { requestContext } from '../../shared/request-context.js';

export async function caseForParticipant(tx: Prisma.TransactionClient, actorId: string, caseId: string) {
  validId(caseId);
  const record = await tx.disputeCase.findUnique({ where: { id: caseId }, include: { transaction: true } });
  if (!record) throw new AppException(404, 'NOT_FOUND', 'Kasus tidak ditemukan.');
  participant(record.transaction, actorId);
  return record;
}

export async function assignedCase(tx: Prisma.TransactionClient, actorId: string, caseId: string, kind?: 'CHAT' | 'EVIDENCE' | 'HANDOVER') {
  validId(caseId);
  const record = await tx.disputeCase.findUnique({ where: { id: caseId }, include: { transaction: true } });
  if (!record || record.assignedAdminId !== actorId) throw new AppException(404, 'NOT_FOUND', 'Kasus tidak ditugaskan kepada akun ini.');
  if (!await tx.user.findFirst({ where: { id: actorId, role: 'ADMIN', status: 'ACTIVE' } })) throw new AppException(403, 'FORBIDDEN', 'Akses hanya untuk admin kasus.');
  if (kind) { const access = await tx.caseAccessGrant.findFirst({ where: { caseId, adminId: actorId, kind, expiresAt: { gt: new Date() } } });
    if (!access) throw new AppException(403, 'ACCESS_REASON_REQUIRED', 'Minta akses beralasan sebelum membuka data privat kasus.');
    const store = requestContext.getStore(); if (store) store.accessExpiresAt = access.expiresAt.toISOString();
  }
  return record;
}
