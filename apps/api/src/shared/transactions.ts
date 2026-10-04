import { requestContext } from './request-context.js';
import { authorizeReplay, requireRecentAuthentication } from './actions.js';
import { createHash } from 'node:crypto';
import { uuidSchema } from '@valora/contracts';
import type { TransactionItemSnapshot, TransactionSnapshot } from '@valora/contracts';
import { Prisma } from '../generated/prisma/client.js';
import type { Transaction } from '../generated/prisma/client.js';
import { AppException } from './http.js';
import type { DatabaseService } from '../infrastructure/database.service.js';

export const activeTransactionStatuses = ['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED', 'DISPUTED'] as const;
export const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function validId(id: string): void { if (!uuidSchema.safeParse(id).success) throw new AppException(404, 'NOT_FOUND', 'Data tidak ditemukan.'); }
export async function serial<T>(db: DatabaseService, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await db.$transaction(async (tx) => {
      // Local MVP: one transaction gate orders all domain writes, policy changes and holds.
      // READ COMMITTED obtains fresh reads after waiting for the gate; a serializable
      // snapshot taken by the lock query could retain permissions revoked while waiting.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(610006)::text`;
      const actor = requestContext.getStore()?.actor;
      if (actor) {
        await lockRows(tx, 'User', [actor.id]);
        const session = await tx.session.findUnique({ where: { id: actor.sessionId }, include: { user: true } });
        if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new AppException(401, 'UNAUTHENTICATED', 'Sesi berakhir. Silakan masuk lagi.');
        if (session.user.status !== 'ACTIVE' || session.user.role !== actor.role) throw new AppException(403, 'ACCOUNT_SUSPENDED', 'Izin akun sudah berubah.');
      }
      return action(tx);
    }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 20000 }); }
    catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      const retryable = code === 'P2034' || /40001|40P01|could not serialize|deadlock detected/.test(String(error));
      if (!retryable) throw error;
      if (attempt === 2) throw new AppException(409, 'STATE_CONFLICT', 'Data sedang berubah. Periksa status lalu coba lagi dengan kunci yang sama.');
    }
  }
  throw new AppException(409, 'STATE_CONFLICT', 'Data sedang berubah.');
}
export async function lockRows(tx: Prisma.TransactionClient, table: 'User' | 'Item' | 'Listing' | 'Offer' | 'Transaction' | 'DisputeCase' | 'CorrectionCase' | 'Report', ids: string[]): Promise<void> {
  const sorted = [...new Set(ids)].sort();
  for (const id of sorted) {
    validId(id);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM ${Prisma.raw('"' + table + '"')} WHERE id = ${id}::uuid FOR UPDATE`);
  }
}
export async function lockTransaction(tx: Prisma.TransactionClient, id: string): Promise<Transaction> {
  validId(id);
  const ref = await tx.transaction.findUnique({ where: { id } });
  if (!ref) throw new AppException(404, 'NOT_FOUND', 'Transaksi tidak ditemukan.');
  await lockRows(tx, 'User', [ref.sellerOrDonorId, ref.buyerOrRecipientId]);
  await lockRows(tx, 'Item', [ref.itemId, ...(ref.offeredItemId ? [ref.offeredItemId] : [])]);
  await lockRows(tx, 'Listing', [ref.listingId]);
  await lockRows(tx, 'Offer', [ref.offerId]);
  await lockRows(tx, 'Transaction', [id]);
  return tx.transaction.findUniqueOrThrow({ where: { id } });
}
export function participant(row: Transaction, actorId: string): void {
  if (row.sellerOrDonorId !== actorId && row.buyerOrRecipientId !== actorId) throw new AppException(404, 'NOT_FOUND', 'Transaksi tidak ditemukan.');
}
export function mutable(row: Transaction, version: number): void {
  if (row.version !== version || !activeTransactionStatuses.includes(row.status as typeof activeTransactionStatuses[number])) throw new AppException(409, 'STATE_CONFLICT', 'Transaksi sudah berubah. Muat ulang sebelum melanjutkan.');
}
export async function idempotent<T>(db: DatabaseService, actorId: string, operation: string, key: string | undefined, payload: unknown, action: (tx: Prisma.TransactionClient, key: string) => Promise<T>): Promise<T> {
  if (!key || !uuidSchema.safeParse(key).success) throw new AppException(400, 'INVALID_INPUT', 'Idempotency-Key UUID wajib untuk tindakan ini.');
  const requestHash = createHash('sha256').update(canonical(payload)).digest('hex');
  return serial(db, async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actorId + ':' + operation + ':' + key}, 0))::text`;
    if (operation.startsWith('ownership-correction:') || operation.startsWith('rubric-publish:')) await requireRecentAuthentication(tx);
    const previous = await tx.idempotencyRequest.findUnique({ where: { actorId_key_operation: { actorId, key, operation } } });
    if (previous) {
      if (previous.requestHash !== requestHash) throw new AppException(409, 'IDEMPOTENCY_CONFLICT', 'Kunci ini sudah dipakai dengan data yang berbeda.');
      if (previous.purgedAt) throw new AppException(410, 'RESPONSE_RETAINED_AS_TOMBSTONE', 'Tindakan sudah diproses; isi respons tidak lagi disimpan. Muat status terkini.');
      await authorizeReplay(tx, actorId, operation, payload);
      return previous.responseBody as T;
    }
    const result = await action(tx, key);
    await tx.idempotencyRequest.create({ data: { actorId, key, operation, requestHash, responseBody: json(result) } });
    return result;
  });
}
export async function eligible(tx: Prisma.TransactionClient, itemId: string, ownerId: string, type: 'RESELL' | 'EXCHANGE' | 'DONATE', assessmentId?: string) {
  const item = await tx.item.findUnique({ where: { id: itemId } });
  if (!item || item.currentOwnerId !== ownerId || item.archivedAt) throw new AppException(409, 'STATE_CONFLICT', 'Kepemilikan Item sudah berubah.');
  const category = await tx.category.findUnique({ where: { code: item.categoryCode } });
  const subcategory = item.subcategoryCode ? await tx.category.findUnique({ where: { code: item.subcategoryCode } }) : null;
  if (!category?.active || (item.subcategoryCode && !subcategory?.active)) throw new AppException(422, 'ACTION_INELIGIBLE', 'Kategori dinonaktifkan.');
  const rubricKey = item.subcategoryCode ? item.categoryCode + '/' + item.subcategoryCode : item.categoryCode;
  const rubric = await tx.rubricVersion.findFirst({ where: { rubricKey, effectiveAt: { lte: new Date() } }, orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }] });
  const assessment = rubric && await tx.assessment.findFirst({ where: { valid: true, itemId, createdById: ownerId, itemRevision: item.itemRevision, rubricVersionId: rubric.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  if (!assessment || (assessmentId && assessment.id !== assessmentId)) throw new AppException(422, 'STALE_ASSESSMENT', 'Gunakan penilaian terkini.');
  if (assessment.status === 'INCOMPLETE' || (type === 'RESELL' && assessment.status !== 'COMPLETE')) throw new AppException(422, 'ASSESSMENT_INCOMPLETE', 'Penilaian belum lengkap untuk jalur ini.');
  const flags = assessment.safetyFlags as string[];
  const recommendations = assessment.recommendationSnapshot as { action: string; status: string }[];
  if (flags.some((f) => f.startsWith('PROHIBITED:')) || !recommendations.some((r) => r.action === type && r.status === 'ELIGIBLE')) throw new AppException(422, 'ACTION_INELIGIBLE', 'Item belum memenuhi syarat transfer.');
  return { item, assessment, rubric: rubric! };
}
export function requiredConfirmations(row: Transaction) {
  const snapshot = row.snapshot as unknown as TransactionSnapshot;
  return snapshot.items.flatMap((item) => [
    { actorId: item.fromUserId, itemId: item.id, kind: 'HANDED_OVER' as const },
    { actorId: item.toUserId, itemId: item.id, kind: 'RECEIVED' as const },
  ]);
}
export async function closeForAccount(tx: Prisma.TransactionClient, userId: string, cause = 'ACCOUNT_CLOSED'): Promise<string[]> {
  const transactions = await tx.transaction.findMany({ where: { status: { in: [...activeTransactionStatuses] }, OR: [{ sellerOrDonorId: userId }, { buyerOrRecipientId: userId }] } });
  const ids: string[] = [];
  for (const ref of transactions.sort((a, b) => a.id.localeCompare(b.id))) {
    const row = await lockTransaction(tx, ref.id);
    const existing = await tx.disputeCase.findFirst({ where: { transactionId: row.id, status: { in: ['OPEN', 'IN_REVIEW'] } } });
    if (!existing) {
      const dispute = await tx.disputeCase.create({ data: { transactionId: row.id, openedById: userId, reason: cause + ': akun peserta tidak aktif saat transaksi masih berjalan.' } });
      await tx.caseEvidence.create({ data: { caseId: dispute.id, submittedById: userId, note: 'Permintaan penutupan akun tercatat oleh sistem. Transaksi memerlukan putusan admin.' } });
      await tx.transaction.update({ where: { id: row.id }, data: { status: 'DISPUTED', version: { increment: 1 } } });
    } else {
      await tx.caseEvidence.create({ data: { caseId: existing.id, submittedById: userId, note: cause + ': status akun peserta dicatat oleh sistem saat kasus masih terbuka.' } });
    }
    ids.push(row.id);
  }
  return ids;
}
export type TransferItem = TransactionItemSnapshot;
