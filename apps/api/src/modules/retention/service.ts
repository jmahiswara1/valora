import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { StorageService } from '../../infrastructure/storage.service.js';
import { ProfilePhotoService } from '../profile/photo.service.js';
import { page, cursorId } from '../../shared/pagination.js';
import { z } from 'zod';
import { retentionHoldSchema, versionReasonSchema } from '@valora/contracts';
import { idempotent, activeTransactionStatuses, serial, lockRows, json } from '../../shared/transactions.js';
import { assignedScope, audit, scopeTransactionIds } from '../operations/helpers.js';
import { AppException } from '../../shared/http.js';
import { Prisma } from '../../generated/prisma/client.js';
import { randomBytes } from 'node:crypto';
import { exclusiveJob } from '../../infrastructure/jobs/lock.js';
import { queueDeletion } from './helpers.js';

const day = 86400000;

const erased = '[Dihapus sesuai retensi]';

@Injectable()
export class RetentionService {
  constructor(private readonly db: DatabaseService, private readonly storage: StorageService, private readonly photos: ProfilePhotoService) {}
  async holds(cursor?: string) { return page(await this.db.retentionHold.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...cursorId(cursor), take: 31, select: { id: true, scopeType: true, scopeId: true, adminId: true, reviewAt: true, revokedAt: true, version: true, createdAt: true } })); }
  async hold(adminId: string, input: z.infer<typeof retentionHoldSchema>, key?: string) {
    return idempotent(this.db, adminId, 'retention-hold', key, input, async (tx) => {
      await assignedScope(tx, adminId, input.scopeType, input.scopeId, true);
      const reviewAt = new Date(input.reviewAt); if (reviewAt <= new Date() || reviewAt.getTime() > Date.now() + 180 * day) throw new AppException(400, 'INVALID_INPUT', 'Jadwal review harus di masa depan dalam 180 hari.');
      const row = await tx.retentionHold.create({ data: { ...input, reviewAt, adminId } });
      await audit(tx, adminId, input.scopeType, input.scopeId, 'RETENTION_HOLD', input.reason, undefined, { holdId: row.id, reviewAt: reviewAt.toISOString() });
      return row;
    });
  }
  async release(adminId: string, id: string, input: z.infer<typeof versionReasonSchema>, key?: string) { return idempotent(this.db, adminId, 'retention-release:' + id, key, input, async (tx) => { const row = await tx.retentionHold.findUnique({ where: { id } }); if (!row || row.version !== input.expectedVersion || row.revokedAt) throw new AppException(409, 'STATE_CONFLICT', 'Hold sudah berubah.'); await assignedScope(tx, adminId, row.scopeType as 'REPORT', row.scopeId, true); const updated = await tx.retentionHold.update({ where: { id }, data: { revokedAt: new Date(), version: { increment: 1 } } }); await audit(tx, adminId, row.scopeType, row.scopeId, 'RELEASE_RETENTION_HOLD', input.reason); return updated; }); }
  async blockedScope(tx: Prisma.TransactionClient, type: string, id: string, now: Date) {
    return Boolean(await tx.retentionHold.findFirst({ where: { scopeType: type, scopeId: id, revokedAt: null, reviewAt: { gt: now } } }));
  }
  async blockedAccount(tx: Prisma.TransactionClient, userId: string, now: Date) {
    const related = await tx.transaction.findMany({ where: { OR: [{ sellerOrDonorId: userId }, { buyerOrRecipientId: userId }] }, select: { id: true, status: true } });
    if (related.some((t) => activeTransactionStatuses.includes(t.status as typeof activeTransactionStatuses[number]))) return true;
    const ids = related.map((t) => t.id);
    const cases = await tx.disputeCase.findMany({ where: { transactionId: { in: ids } } });
    for (const c of cases) if (['OPEN', 'IN_REVIEW'].includes(c.status) || (c.retentionHoldUntil && c.retentionHoldUntil > now) || await this.blockedScope(tx, 'DISPUTE', c.id, now)) return true;
    const corrections = await tx.correctionCase.findMany({ where: { transactionId: { in: ids } } });
    for (const c of corrections) if (['OPEN', 'IN_REVIEW'].includes(c.status) || await this.blockedScope(tx, 'CORRECTION', c.id, now)) return true;
    const conversations = await tx.conversation.findMany({ where: { OR: [{ participantAId: userId }, { participantBId: userId }] }, select: { listingId: true } });
    const messages = await tx.message.findMany({ where: { conversation: { OR: [{ participantAId: userId }, { participantBId: userId }] } }, select: { id: true } });
    const listingIds = (await tx.listing.findMany({ where: { ownerId: userId }, select: { id: true } })).map((l) => l.id);
    const reviews = await tx.review.findMany({ where: { OR: [{ authorId: userId }, { subjectId: userId }] }, select: { id: true } });
    const replies = await tx.reviewReply.findMany({ where: { OR: [{ authorId: userId }, { reviewId: { in: reviews.map(r => r.id) } }] }, select: { id: true } });
    const reports = await tx.report.findMany({ where: { OR: [{ reporterId: userId }, { targetId: { in: [userId, ...ids, ...reviews.map(r => r.id), ...replies.map(r => r.id), ...listingIds, ...conversations.map((c) => c.listingId), ...messages.map((m) => m.id)] } }] } });
    for (const r of reports) if (['OPEN', 'IN_REVIEW'].includes(r.status) || (r.retentionHoldUntil && r.retentionHoldUntil > now) || await this.blockedScope(tx, 'REPORT', r.id, now)) return true;
    return false;
  }
  async accounts(now = new Date()) {
    let count = 0;
    let cursor: string | undefined;
    for (;;) {
    const accounts = await this.db.user.findMany({ where: { status: 'CLOSED', closedAt: { lte: new Date(now.getTime() - 30 * day) }, anonymizedAt: null, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: 25 });
    if (!accounts.length) break;
    cursor = accounts.at(-1)!.id;
    for (const account of accounts) count += await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [account.id]);
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: account.id } });
      if (fresh.anonymizedAt || fresh.status !== 'CLOSED' || await this.blockedAccount(tx, account.id, now)) return 0;
      const assets = await tx.mediaAsset.findMany({ where: { OR: [{ item: { currentOwnerId: account.id, reservedByTransactionId: null, transfers: { none: {} } } }, { uploadedById: account.id, repairRecordId: { not: null }, shareWithFutureOwner: false }], caseId: null, deletedAt: null } });
      for (const asset of assets) { await tx.mediaAsset.update({ where: { id: asset.id }, data: { deletedAt: now } }); await queueDeletion(tx, asset.storageKey, now); }
      await tx.item.updateMany({ where: { currentOwnerId: account.id, reservedByTransactionId: null, transfers: { none: {} } }, data: { archivedAt: now, title: erased, description: erased, functionSummary: null, conditionSummary: null, completenessSummary: null, issueSummary: null, purchaseYear: null, originalPriceIdr: null } });
      await tx.repairRecord.updateMany({ where: { createdById: account.id }, data: { costIdr: null, costKind: null, privateNotes: null } });
      await tx.assessment.updateMany({ where: { createdById: account.id }, data: { answersSnapshot: {}, sourceSnapshot: {} } });
      await tx.repairCorrection.updateMany({ where: { createdById: account.id }, data: { responseSnapshot: Prisma.DbNull, beforeState: {}, afterState: {} } });
      await tx.idempotencyRequest.updateMany({ where: { actorId: account.id, purgedAt: null }, data: { responseBody: { retained: false }, purgedAt: now } });
      await tx.review.updateMany({ where: { authorId: account.id, purgedAt: null }, data: { comment: null, purgedAt: now, version: { increment: 1 } } });
      await tx.reviewReply.updateMany({ where: { authorId: account.id, purgedAt: null }, data: { body: null, purgedAt: now, version: { increment: 1 } } });
      await tx.user.update({ where: { id: account.id }, data: { profilePhotoPublic: false, email: 'closed-' + account.id + '@invalid.valora.local', pendingEmail: null, displayName: 'Akun ditutup', cityId: null, closureReason: null, passwordHash: randomBytes(32).toString('hex'), anonymizedAt: now, version: { increment: 1 } } });
      await tx.session.deleteMany({ where: { userId: account.id } }); await tx.verificationToken.deleteMany({ where: { userId: account.id } });
      return 1;
    });
    }
    return count;
  }
  async purge(now = new Date()) { return await exclusiveJob('retention', () => this.purgeUnlocked(now)) ?? { messages: 0, cases: 0, accounts: 0, storage: 0, skipped: true }; }
  private async purgeUnlocked(now: Date) {
    const run = await this.db.maintenanceRun.create({ data: { job: 'RETENTION', startedAt: now } });
    try {
      let messages = 0; let casesPurged = 0;
      const conversations = await this.db.conversation.findMany({ where: { OR: [{ createdAt: { lte: new Date(now.getTime() - 90 * day) } }, { messages: { some: { deletedAt: null, sentAt: { lte: new Date(now.getTime() - 90 * day) } } } }, { listing: { transactions: { some: { status: { in: ['COMPLETED', 'CANCELLED'] }, OR: [{ completedAt: { lte: new Date(now.getTime() - 180 * day) } }, { cancelledAt: { lte: new Date(now.getTime() - 180 * day) } }] } } } }] }, include: { messages: { orderBy: { sentAt: 'desc' }, take: 1 } } });
      for (const ref of conversations) {
        const result = await serial(this.db, async (tx) => {
          await lockRows(tx, 'User', [ref.participantAId, ref.participantBId]);
          const conversation = await tx.conversation.findUniqueOrThrow({ where: { id: ref.id }, include: { messages: { orderBy: { sentAt: 'desc' }, take: 1 } } });
          const transactions = await tx.transaction.findMany({ where: { listingId: ref.listingId, sellerOrDonorId: { in: [ref.participantAId, ref.participantBId] }, buyerOrRecipientId: { in: [ref.participantAId, ref.participantBId] } } });
          if (transactions.some((t) => activeTransactionStatuses.includes(t.status as typeof activeTransactionStatuses[number]))) return { messages: 0, cases: 0 };
          const ids = transactions.map((t) => t.id); const messageIds = (await tx.message.findMany({ where: { conversationId: ref.id }, select: { id: true } })).map((m) => m.id);
          const disputes = await tx.disputeCase.findMany({ where: { transactionId: { in: ids } } });
          const corrections = await tx.correctionCase.findMany({ where: { transactionId: { in: ids } } });
          const reviewIds = (await tx.review.findMany({ where: { transactionId: { in: ids } }, select: { id: true } })).map(r => r.id);
          const replyIds = (await tx.reviewReply.findMany({ where: { reviewId: { in: reviewIds } }, select: { id: true } })).map(r => r.id);
          const reports = await tx.report.findMany({ where: { OR: [{ targetType: 'REVIEW', targetId: { in: reviewIds } }, { targetType: 'REVIEW_REPLY', targetId: { in: replyIds } }, { targetType: 'LISTING', targetId: ref.listingId }, { targetType: 'TRANSACTION', targetId: { in: ids } }, { messageId: { in: messageIds } }, { targetType: 'USER', targetId: { in: [ref.participantAId, ref.participantBId] } }, { reporterId: { in: [ref.participantAId, ref.participantBId] }, targetType: 'USER' }] } });
          const scopes = [...disputes.map((r) => ({ ...r, type: 'DISPUTE' })), ...corrections.map((r) => ({ ...r, type: 'CORRECTION', retentionHoldUntil: null })), ...reports.map((r) => ({ ...r, type: 'REPORT' }))];
          for (const scope of scopes) if (['OPEN', 'IN_REVIEW'].includes(scope.status) || (scope.retentionHoldUntil && scope.retentionHoldUntil > now) || await this.blockedScope(tx, scope.type, scope.id, now)) return { messages: 0, cases: 0 };
          const associated = transactions.length || scopes.length;
          const latest = associated ? Math.max(...transactions.map((t) => (t.completedAt ?? t.cancelledAt ?? t.acceptedAt).getTime()), ...scopes.map((s) => (s.resolvedAt ?? s.createdAt).getTime())) : (conversation.messages[0]?.sentAt.getTime() ?? conversation.createdAt.getTime());
          if (now.getTime() - latest < (associated ? 180 : 90) * day) return { messages: 0, cases: 0 };
          const photos = await tx.messageAttachment.findMany({ where: { messageId: { in: messageIds }, deletedAt: null } });
          for (const photo of photos) await tx.storageDeletion.upsert({ where: { storageKey: photo.storageKey }, update: {}, create: { storageKey: photo.storageKey } });
          await tx.messageAttachment.updateMany({ where: { messageId: { in: messageIds }, deletedAt: null }, data: { deletedAt: now } });
          const deleted = await tx.message.updateMany({ where: { conversationId: ref.id, deletedAt: null }, data: { body: erased, deletedAt: now } });
          await tx.caseEvidence.updateMany({ where: { OR: [{ messageId: { in: messageIds } }, { caseId: { in: disputes.map((c) => c.id) } }] }, data: { note: null, messageSnapshot: Prisma.DbNull } });
          await tx.correctionEvidence.updateMany({ where: { OR: [{ messageId: { in: messageIds } }, { caseId: { in: corrections.map((c) => c.id) } }] }, data: { note: erased, messageSnapshot: Prisma.DbNull, purgedAt: now } });
          const media = await tx.mediaAsset.findMany({ where: { caseId: { in: disputes.map((c) => c.id) }, deletedAt: null } });
          for (const asset of media) { await tx.mediaAsset.update({ where: { id: asset.id }, data: { deletedAt: now } }); await queueDeletion(tx, asset.storageKey, now); }
          const attachments = await tx.correctionAttachment.findMany({ where: { evidence: { caseId: { in: corrections.map((c) => c.id) } }, deletedAt: null } });
          for (const asset of attachments) { await tx.correctionAttachment.update({ where: { id: asset.id }, data: { deletedAt: now } }); await queueDeletion(tx, asset.storageKey, now); }
          await tx.disputeCase.updateMany({ where: { id: { in: disputes.map((c) => c.id) } }, data: { reason: erased, resolutionReason: null } });
          await tx.correctionCase.updateMany({ where: { id: { in: corrections.map((c) => c.id) } }, data: { reason: erased, resolutionReason: null } });
          await tx.report.updateMany({ where: { id: { in: reports.map((c) => c.id) } }, data: { details: erased } });
          await tx.transaction.updateMany({ where: { id: { in: ids } }, data: { privateSnapshot: {} } });
          const handovers = await tx.handoverProposal.findMany({ where: { transactionId: { in: ids } }, select: { id: true } });
          await tx.shipmentRecord.updateMany({ where: { proposalId: { in: handovers.map(p => p.id) }, purgedAt: null }, data: { courier: null, trackingNumber: null, reason: null, purgedAt: now } });
          await tx.handoverProposal.updateMany({ where: { transactionId: { in: ids }, purgedAt: null }, data: { privateDetails: Prisma.DbNull, purgedAt: now } });
          await tx.cancellationRequest.updateMany({ where: { transactionId: { in: ids } }, data: { reason: erased } });
          await tx.caseAccessGrant.updateMany({ where: { caseId: { in: disputes.map((c) => c.id) } }, data: { reason: erased } });
          await tx.operationsAccessGrant.updateMany({ where: { scopeId: { in: scopes.map((c) => c.id) } }, data: { reason: erased } });
          await tx.retentionHold.updateMany({ where: { scopeId: { in: scopes.map((c) => c.id) }, OR: [{ revokedAt: { not: null } }, { reviewAt: { lte: now } }] }, data: { reason: erased } });
          for (const transaction of transactions) {
            const snapshot = transaction.snapshot as { parties?: { id: string; displayName: string }[] };
            await tx.transaction.update({ where: { id: transaction.id }, data: { snapshot: json({ ...snapshot, parties: snapshot.parties?.map((p) => ({ id: p.id, displayName: 'Peserta terdahulu' })) ?? [] }) } });
          }
          // Responses duplicate private evidence and case text. Retain keys and hashes as tombstones.
          const references = new Set([ref.id, ...ids, ...messageIds, ...scopes.map((s) => s.id)]);
          const pattern = [...references].join('|');
          const cached = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "IdempotencyRequest" WHERE "purgedAt" IS NULL AND ("operation" ~ ${pattern} OR "responseBody"::text ~ ${pattern})`;
          await tx.idempotencyRequest.updateMany({ where: { id: { in: cached.map((c) => c.id) }, purgedAt: null }, data: { responseBody: { retained: false }, purgedAt: now } });
          await tx.adminAction.updateMany({ where: { OR: [{ targetId: { in: [...references] } }, { reportId: { in: reports.map((r) => r.id) } }] }, data: { beforeState: Prisma.DbNull, afterState: Prisma.DbNull, reason: erased } });
          return { messages: deleted.count, cases: scopes.filter((s) => ('reason' in s ? s.reason : s.details) !== erased).length };
        });
        messages += result.messages; casesPurged += result.cases;
      }
      const closedReports = await this.db.report.findMany({ where: { status: { in: ['RESOLVED', 'DISMISSED'] }, resolvedAt: { lte: new Date(now.getTime() - 180 * day) }, details: { not: erased } } });
      for (const report of closedReports) await serial(this.db, async (tx) => {
        await lockRows(tx, 'Report', [report.id]);
        const freshReport = await tx.report.findUniqueOrThrow({ where: { id: report.id } });
        if (freshReport.details === erased || !['RESOLVED', 'DISMISSED'].includes(freshReport.status)) return;
        if ((freshReport.retentionHoldUntil && freshReport.retentionHoldUntil > now) || await this.blockedScope(tx, 'REPORT', report.id, now)) return;
        const transactions = await tx.transaction.findMany({ where: { id: { in: await scopeTransactionIds(tx, 'REPORT', report.id) } } });
        if (transactions.some((t) => activeTransactionStatuses.includes(t.status as typeof activeTransactionStatuses[number]) || now.getTime() - (t.completedAt ?? t.cancelledAt ?? t.acceptedAt).getTime() < 180 * day)) return;
        await tx.report.update({ where: { id: report.id }, data: { details: erased } });
        await tx.operationsAccessGrant.updateMany({ where: { scopeType: 'REPORT', scopeId: report.id }, data: { reason: erased } });
        await tx.retentionHold.updateMany({ where: { scopeType: 'REPORT', scopeId: report.id, OR: [{ revokedAt: { not: null } }, { reviewAt: { lte: now } }] }, data: { reason: erased } });
        await tx.adminAction.updateMany({ where: { OR: [{ reportId: report.id }, { targetType: 'REPORT', targetId: report.id }] }, data: { reason: erased, beforeState: Prisma.DbNull, afterState: Prisma.DbNull } });
        const caches = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "IdempotencyRequest" WHERE "purgedAt" IS NULL AND ("operation" ~ ${report.id} OR "responseBody"::text ~ ${report.id})`;
        await tx.idempotencyRequest.updateMany({ where: { id: { in: caches.map((c) => c.id) }, purgedAt: null }, data: { responseBody: { retained: false }, purgedAt: now } });
        casesPurged++;
      });
      const accounts = await this.accounts(now);
      const storage = await this.drain(now);
      const counts = { messages, cases: casesPurged, accounts, storage };
      await this.db.maintenanceRun.update({ where: { id: run.id }, data: { completedAt: new Date(), status: 'COMPLETED', counts: json(counts) } }); return counts;
    } catch (error) { await this.db.maintenanceRun.update({ where: { id: run.id }, data: { completedAt: new Date(), status: 'FAILED', error: 'Retention job failed; retry required.' } }); throw error; }
  }
  async drain(now = new Date()) { return await exclusiveJob('storage-drain', () => this.drainUnlocked(now)) ?? 0; }
  private async drainUnlocked(now: Date) {
    let count = 0;
    const rows = await this.db.storageDeletion.findMany({ where: { completedAt: null, nextAttemptAt: { lte: now } }, take: 100 });
    for (const row of rows) try { if (row.kind === 'MAIL') await this.storage.removeMail(row.storageKey); else if (row.kind === 'PHOTO_LOCAL' || row.kind === 'PHOTO_CLOUD') await this.photos.deleteQueued(row.kind, row.storageKey); else await this.storage.remove(row.storageKey); await this.db.storageDeletion.update({ where: { id: row.id }, data: { completedAt: now, lastError: null } }); count++; }
    catch { await this.db.storageDeletion.update({ where: { id: row.id }, data: { attempts: { increment: 1 }, lastError: 'Storage deletion failed', nextAttemptAt: new Date(now.getTime() + Math.min(24 * 3600000, 60000 * 2 ** Math.min(row.attempts, 10))) } }); }
    return count;
  }
}
