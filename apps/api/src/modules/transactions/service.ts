import { invalidateTutorials } from '../../shared/tutorials.js';
import { invalidateHandover } from '../handover/lifecycle.js';
import { expireOffers, notify, notifyTransaction } from '../notifications/events.js';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import type { OfferAcceptInput, ExchangeTerms, CashConfirmationInput, TransactionItemSnapshot, TransactionDto, ConfirmationInput, TransactionSnapshot } from '@valora/contracts';
import { validId, idempotent, lockRows, eligible, json, lockTransaction, participant, mutable, requiredConfirmations, activeTransactionStatuses, serial } from '../../shared/transactions.js';
import { AppException } from '../../shared/http.js';
import type { Transaction, Prisma } from '../../generated/prisma/client.js';
import { transactionDto, paging } from './helpers.js';
import type { PageQuery } from './shared.js';
import { advancedExchange, exchangeHash, exchangeItems, validateExchange, requiredCash, cashReady } from '../../shared/exchange.js';

const day = 86400000;

@Injectable()
export class TransactionsService {
  constructor(private readonly db: DatabaseService) {}

  async accept(actorId: string, offerId: string, input: OfferAcceptInput, key?: string) {
    validId(offerId);
    return idempotent(this.db, actorId, 'accept:' + offerId, key, input, async (tx) => {
      const ref = await tx.offer.findUnique({ where: { id: offerId }, include: { listing: true, currentRevision: true } });
      if (!ref || (actorId !== ref.bidderId && actorId !== ref.listing.ownerId)) throw new AppException(404, 'NOT_FOUND', 'Penawaran tidak ditemukan.');
      await lockRows(tx, 'User', [ref.bidderId, ref.listing.ownerId]);
      const captured = ref.currentRevision?.exchangeTerms as unknown as ExchangeTerms | null;
      await lockRows(tx, 'Item', [ref.listing.itemId, ...(captured ? exchangeItems(captured).map(item => item.id) : ref.exchangeItemId ? [ref.exchangeItemId] : [])]);
      await lockRows(tx, 'Listing', [ref.listingId]);
      await lockRows(tx, 'Offer', [offerId]);
      const offer = await tx.offer.findUniqueOrThrow({ where: { id: offerId }, include: { listing: { include: { currentRevision: { include: { media: true } } } }, currentRevision: true, revisions: { orderBy: { revisionNo: 'desc' }, take: 1 } } });
      const listing = offer.listing; const revision = listing.currentRevision; const final = offer.currentRevision ?? offer.revisions[0];
      if (!final || final.respondsById !== actorId) throw new AppException(403, 'FORBIDDEN', 'Hanya penerima revisi ini yang dapat menyetujuinya.');
      if (offer.expiresAt <= new Date()) throw new AppException(410, 'OFFER_EXPIRED', 'Masa penawaran telah berakhir.');
      if (listing.status === 'RESERVED') throw new AppException(409, 'ITEM_RESERVED', 'Item sudah dipilih untuk transaksi lain.');
      if (!revision || listing.status !== 'ACTIVE' || !['PENDING', 'COUNTERED'].includes(offer.status) || offer.version !== input.expectedVersion || final.id !== input.offerRevisionId || revision.id !== input.listingRevisionId || offer.listingRevisionId !== revision.id) throw new AppException(409, 'STATE_CONFLICT', 'Penawaran atau Listing sudah berubah.');
      const users = await tx.user.findMany({ where: { id: { in: [listing.ownerId, offer.bidderId] } } });
      if (users.length !== 2 || users.some((u) => u.status !== 'ACTIVE' || !u.emailVerifiedAt)) throw new AppException(403, 'FORBIDDEN', 'Kedua akun harus aktif dan terverifikasi.');
      if (await tx.userBlock.findFirst({ where: { revokedAt: null, OR: [{ blockerId: listing.ownerId, blockedId: offer.bidderId }, { blockerId: offer.bidderId, blockedId: listing.ownerId }] } })) throw new AppException(403, 'FORBIDDEN', 'Interaksi antar akun dibatasi.');
      const main = await eligible(tx, listing.itemId, listing.ownerId, listing.type, revision.assessmentId);
      if (main.item.reservedByTransactionId || revision.itemRevision !== main.item.itemRevision || revision.rubricVersionId !== main.rubric.id) throw new AppException(409, 'ITEM_RESERVED', 'Item atau penilaiannya sudah berubah.');
      const mediaIds = revision.media.map((m) => m.mediaId);
      if (!mediaIds.length || await tx.mediaAsset.count({ where: { id: { in: mediaIds }, deletedAt: null, caseId: null, repairRecordId: null } }) !== mediaIds.length) throw new AppException(422, 'ACTION_NEEDS_DATA', 'Foto kesepakatan tidak lagi tersedia.');
      const items: TransactionItemSnapshot[] = [{ id: main.item.id, itemRevision: main.item.itemRevision, assessmentId: main.assessment.id, title: revision.title, description: revision.description, conditionSummary: revision.conditionDisclosure, categoryCode: main.item.categoryCode, subcategoryCode: main.item.subcategoryCode, estimatedWeightGrams: main.item.estimatedWeightGrams, mediaIds, fromUserId: listing.ownerId, toUserId: offer.bidderId }];
      const privateItems = [{ id: main.item.id, purchaseYear: main.item.purchaseYear, originalPriceIdr: main.item.originalPriceIdr === null ? null : Number(main.item.originalPriceIdr) }];
      const terms = final.exchangeTerms as unknown as ExchangeTerms | null;
      if (listing.type === 'EXCHANGE' && terms) {
        if ((advancedExchange(terms) || input.exchangeTermsHash !== undefined) && input.exchangeTermsHash !== exchangeHash(terms)) throw new AppException(409, 'STATE_CONFLICT', 'Tinjau seluruh barang dan tambahan uang sebelum menerima revisi ini.');
        await validateExchange(tx, terms, listing, offer.bidderId);
        items.splice(0, items.length, ...exchangeItems(terms)); privateItems.splice(0);
        for (const snapshot of items) {
          const item = await tx.item.findUniqueOrThrow({ where: { id: snapshot.id } });
          privateItems.push({ id: item.id, purchaseYear: item.purchaseYear, originalPriceIdr: item.originalPriceIdr === null ? null : Number(item.originalPriceIdr) });
        }
      } else if (listing.type === 'EXCHANGE') {
        const snapshot = offer.exchangeSnapshot as unknown as TransactionItemSnapshot | null;
        if (!offer.exchangeItemId || !snapshot) throw new AppException(409, 'STATE_CONFLICT', 'Kirim ulang Offer Exchange dengan snapshot Item.');
        const other = await eligible(tx, offer.exchangeItemId, offer.bidderId, 'EXCHANGE', snapshot.assessmentId);
        if (other.item.reservedByTransactionId) throw new AppException(409, 'ITEM_RESERVED', 'Item penukar sudah direservasi.');
        if (snapshot.itemRevision !== other.item.itemRevision || snapshot.id !== other.item.id || await tx.listing.findFirst({ where: { itemId: other.item.id, status: { in: ['ACTIVE', 'RESERVED'] } } })) throw new AppException(409, 'STATE_CONFLICT', 'Item penukar berubah atau memiliki Listing aktif.');
        if (!snapshot.mediaIds.length || await tx.mediaAsset.count({ where: { id: { in: snapshot.mediaIds }, itemId: other.item.id, deletedAt: null, caseId: null, repairRecordId: null } }) !== snapshot.mediaIds.length) throw new AppException(422, 'ACTION_NEEDS_DATA', 'Foto Item penukar tidak lagi tersedia.');
        items.push({ ...snapshot, estimatedWeightGrams: other.item.estimatedWeightGrams, fromUserId: offer.bidderId, toUserId: listing.ownerId });
        privateItems.push({ id: other.item.id, purchaseYear: other.item.purchaseYear, originalPriceIdr: other.item.originalPriceIdr === null ? null : Number(other.item.originalPriceIdr) });
      }
      const acceptedAt = new Date();
      const row = await tx.transaction.create({ data: { listingId: listing.id, offerId, itemId: main.item.id, offeredItemId: offer.exchangeItemId, sellerOrDonorId: listing.ownerId, buyerOrRecipientId: offer.bidderId, type: listing.type, finalPriceIdr: listing.type === 'RESELL' ? final.priceIdr : null, snapshot: json({ listingRevisionId: revision.id, offerRevisionId: final.id, items, parties: users.map((u) => ({ id: u.id, displayName: u.displayName })), handoverMethods: revision.handoverMethods, cashAdjustment: listing.type === 'EXCHANGE' ? terms?.cashAdjustment ?? null : null }), privateSnapshot: json(privateItems), items: { create: items.map(item => ({ itemId: item.id })) }, acceptedAt, targetHandoverAt: new Date(acceptedAt.getTime() + 14 * day) } });
      const reserved = await tx.item.updateMany({ where: { id: { in: items.map((i) => i.id) }, reservedByTransactionId: null, archivedAt: null }, data: { reservedByTransactionId: row.id, version: { increment: 1 } } });
      if (reserved.count !== items.length) throw new AppException(409, 'ITEM_RESERVED', 'Sebagian barang sudah tidak tersedia. Seluruh reservasi dibatalkan.');
      await tx.listing.update({ where: { id: listing.id }, data: { status: 'RESERVED', version: { increment: 1 } } });
      await tx.offer.update({ where: { id: offerId }, data: { status: 'ACCEPTED', version: { increment: 1 } } });
      const [participantAId, participantBId] = [listing.ownerId, offer.bidderId].sort();
      await tx.conversation.upsert({ where: { listingId_participantAId_participantBId: { listingId: listing.id, participantAId, participantBId } }, update: {}, create: { listingId: listing.id, participantAId, participantBId } });
      await notifyTransaction(tx, row, 'TRANSACTION_STARTED', `transaction:${row.id}:started`);
      return transactionDto(tx, row);
    });
  }

  async get(actorId: string, id: string): Promise<TransactionDto> {
    validId(id);
    const row = await this.db.transaction.findUnique({ where: { id } });
    if (!row) throw new AppException(404, 'NOT_FOUND', 'Transaksi tidak ditemukan.');
    if (row.sellerOrDonorId !== actorId && row.buyerOrRecipientId !== actorId) {
      const admin = await this.db.user.findFirst({ where: { id: actorId, role: 'ADMIN', status: 'ACTIVE' } });
      if (!admin || !await this.db.disputeCase.findFirst({ where: { transactionId: id, assignedAdminId: actorId } })) throw new AppException(404, 'NOT_FOUND', 'Transaksi tidak ditemukan.');
    }
    return transactionDto(this.db, row);
  }

  async list(actorId: string, query: PageQuery) {
    const cursor = paging(query, ['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED', 'DISPUTED', 'CANCELLED', 'COMPLETED']);
    const rows = await this.db.transaction.findMany({ where: { AND: [{ OR: [{ sellerOrDonorId: actorId }, { buyerOrRecipientId: actorId }] }, cursor], ...(query.status ? { status: query.status as Transaction['status'] } : {}) }, orderBy: [{ acceptedAt: 'desc' }, { id: 'desc' }], take: query.limit + 1 });
    const page = rows.slice(0, query.limit); const last = page.at(-1);
    return { data: await Promise.all(page.map((row) => transactionDto(this.db, row))), meta: { nextCursor: rows.length > query.limit && last ? Buffer.from(JSON.stringify({ at: last.acceptedAt.toISOString(), id: last.id, status: query.status })).toString('base64url') : null } };
  }

  async confirm(actorId: string, id: string, input: ConfirmationInput, key?: string) {
    return idempotent(this.db, actorId, 'confirm:' + id, key, input, async (tx, requestKey) => {
      const row = await lockTransaction(tx, id); participant(row, actorId); mutable(row, input.expectedVersion);
      if (row.status === 'DISPUTED') throw new AppException(409, 'STATE_CONFLICT', 'Konfirmasi ditahan selama sengketa.');
      if (!requiredConfirmations(row).some((c) => c.actorId === actorId && c.itemId === input.itemId && c.kind === input.kind)) throw new AppException(403, 'FORBIDDEN', 'Konfirmasi ini bukan tindakanmu pada barang tersebut.');
      await invalidateHandover(tx, id, 'FIRST_CONFIRMATION', actorId);
      const confirmation = await tx.handoverConfirmation.upsert({ where: { transactionId_actorId_itemId_kind: { transactionId: id, actorId, itemId: input.itemId, kind: input.kind } }, update: {}, create: { transactionId: id, actorId, itemId: input.itemId, kind: input.kind, idempotencyKey: requestKey } });
      const count = await tx.handoverConfirmation.count({ where: { transactionId: id } });
      if (count === requiredConfirmations(row).length && await cashReady(tx, row)) await this.complete(tx, row, 'USER_CONFIRMED');
      else {
        await tx.transaction.update({ where: { id }, data: { status: 'ONE_SIDE_CONFIRMED', version: { increment: 1 } } });
        await notifyTransaction(tx, row, 'HANDOVER_CONFIRMED', `confirmation:${confirmation.id}`, actorId);
      }
      return transactionDto(tx, await tx.transaction.findUniqueOrThrow({ where: { id } }));
    });
  }

  async confirmCash(actorId: string, id: string, input: CashConfirmationInput, key?: string) {
    return idempotent(this.db, actorId, 'cash-confirm:' + id, key, input, async tx => {
      const row = await lockTransaction(tx, id); participant(row, actorId); mutable(row, input.expectedVersion);
      if (row.status === 'DISPUTED') throw new AppException(409, 'STATE_CONFLICT', 'Konfirmasi ditahan selama sengketa.');
      if (!requiredCash(row).some(need => need.actorId === actorId && need.kind === input.kind)) throw new AppException(403, 'FORBIDDEN', 'Konfirmasi tambahan uang ini bukan tindakanmu.');
      const confirmation = await tx.cashConfirmation.upsert({ where: { transactionId_kind: { transactionId: id, kind: input.kind } }, update: {}, create: { transactionId: id, actorId, kind: input.kind } });
      if (await cashReady(tx, row) && await tx.handoverConfirmation.count({ where: { transactionId: id } }) === requiredConfirmations(row).length) await this.complete(tx, row, 'USER_CONFIRMED');
      else {
        await tx.transaction.update({ where: { id }, data: { status: 'ONE_SIDE_CONFIRMED', version: { increment: 1 } } });
        await notifyTransaction(tx, row, 'EXCHANGE_CASH_CONFIRMED', 'cash-confirmation:' + confirmation.id, actorId);
      }
      return transactionDto(tx, await tx.transaction.findUniqueOrThrow({ where: { id } }));
    });
  }

  async complete(tx: Prisma.TransactionClient, row: Transaction, origin: 'USER_CONFIRMED' | 'ADMIN_AUTHORIZED'): Promise<void> {
    if (row.status === 'COMPLETED' || row.status === 'CANCELLED' || (row.status === 'DISPUTED' && origin !== 'ADMIN_AUTHORIZED')) throw new AppException(409, 'STATE_CONFLICT', 'Transaksi tidak dapat diselesaikan.');
    if (origin === 'USER_CONFIRMED' && (await tx.handoverConfirmation.count({ where: { transactionId: row.id } }) !== requiredConfirmations(row).length || !await cashReady(tx, row))) throw new AppException(409, 'STATE_CONFLICT', 'Konfirmasi seluruh barang dan tambahan uang belum lengkap.');
    const snapshot = row.snapshot as unknown as TransactionSnapshot; const now = new Date();
    const listing = await tx.listing.findUniqueOrThrow({ where: { id: row.listingId } });
    if (listing.status !== 'RESERVED' || listing.currentRevisionId !== snapshot.listingRevisionId) throw new AppException(409, 'STATE_CONFLICT', 'Listing kesepakatan tidak sesuai.');
    for (const item of snapshot.items) {
      const current = await tx.item.findUniqueOrThrow({ where: { id: item.id } });
      if (current.currentOwnerId !== item.fromUserId || current.reservedByTransactionId !== row.id || current.archivedAt || current.itemRevision !== item.itemRevision) throw new AppException(409, 'STATE_CONFLICT', 'Kepemilikan atau reservasi Item berubah.');
      await invalidateTutorials(tx, item.id, 'OWNERSHIP_CHANGED');
      await tx.item.update({ where: { id: item.id }, data: { currentOwnerId: item.toUserId, reservedByTransactionId: null, title: item.title, description: item.description, conditionSummary: item.conditionSummary, functionSummary: null, completenessSummary: null, issueSummary: null, purchaseYear: null, originalPriceIdr: null, itemRevision: { increment: 1 }, version: { increment: 1 } } });
      await tx.mediaAsset.updateMany({ where: { id: { in: item.mediaIds }, caseId: null, repairRecordId: null }, data: { shareWithFutureOwner: true } });
      await tx.ownershipTransfer.create({ data: { transactionId: row.id, itemId: item.id, fromUserId: item.fromUserId, toUserId: item.toUserId, effectiveAt: now, origin } });
      await tx.passportEvent.create({ data: { itemId: item.id, eventKey: 'transfer:' + row.id + ':' + item.id, eventType: row.type === 'RESELL' ? 'TRANSFERRED_BY_SALE' : row.type === 'EXCHANGE' ? 'TRANSFERRED_BY_EXCHANGE' : 'TRANSFERRED_BY_DONATION', sourceType: 'TRANSACTION', sourceId: row.id, origin, publicPayload: json({ type: row.type, origin, label: origin === 'ADMIN_AUTHORIZED' ? 'Tercatat melalui putusan admin' : 'Tercatat setelah konfirmasi kedua pihak' }), occurredAt: now } });
      if (item.estimatedWeightGrams !== null) {
        for (const attributedUserId of [null, item.fromUserId]) await this.impact(tx, row.id, 'ESTIMATED_TRANSFER_WEIGHT', BigInt(item.estimatedWeightGrams), 'GRAM', now, attributedUserId, item.id);
      }
      const oldListings = await tx.listing.findMany({ where: { itemId: item.id, id: { not: row.listingId }, status: { notIn: ['CLOSED', 'WITHDRAWN'] } }, select: { id: true } });
      await tx.listing.updateMany({ where: { id: { in: oldListings.map((l) => l.id) } }, data: { status: 'WITHDRAWN', publishedAt: null, closedAt: now, version: { increment: 1 } } });
      await expireOffers(tx, { status: { in: ['PENDING', 'COUNTERED'] }, OR: [{ exchangeItemId: item.id }, { listingId: { in: [row.listingId, ...oldListings.map((l) => l.id)] } }] }, 'OWNERSHIP_TRANSFERRED');
    }
    for (const userId of [null, row.sellerOrDonorId, row.buyerOrRecipientId]) await this.impact(tx, row.id, 'COMPLETED_TRANSFERS', 1n, 'COUNT', now, userId);
    if (row.type === 'RESELL' && row.finalPriceIdr !== null) for (const userId of [null, row.sellerOrDonorId]) await this.impact(tx, row.id, 'CONFIRMED_SALE_VALUE', row.finalPriceIdr, 'IDR', now, userId);
    await tx.listing.update({ where: { id: row.listingId }, data: { status: 'CLOSED', closedAt: now, publishedAt: null, version: { increment: 1 } } });
    await tx.cancellationRequest.updateMany({ where: { transactionId: row.id, status: 'PENDING' }, data: { status: 'REJECTED', endReason: 'TRANSACTION_COMPLETED', respondedAt: now } });
    await invalidateHandover(tx, row.id, 'TRANSACTION_COMPLETED');
    await tx.transaction.update({ where: { id: row.id }, data: { status: 'COMPLETED', completedAt: now, resolutionOrigin: origin, version: { increment: 1 } } });
    await notifyTransaction(tx, row, 'TRANSACTION_COMPLETED', `transaction:${row.id}:completed`);
  }

  private async impact(tx: Prisma.TransactionClient, sourceId: string, metric: string, delta: bigint, unit: string, occurredAt: Date, attributedUserId: string | null, itemId: string | null = null) {
    await tx.impactEvent.create({ data: { eventKey: [metric, sourceId, attributedUserId ?? 'PLATFORM', itemId ?? 'ALL'].join(':'), metric, sourceType: 'TRANSACTION', sourceId, itemId, attributedUserId, delta, unit, occurredAt } });
  }

  async requestCancel(actorId: string, id: string, input: { expectedVersion: number; reason: string }, key?: string) {
    return idempotent(this.db, actorId, 'cancel-request:' + id, key, input, async (tx) => {
      const row = await lockTransaction(tx, id); participant(row, actorId); mutable(row, input.expectedVersion);
      if (row.status === 'DISPUTED' || await tx.cancellationRequest.findFirst({ where: { transactionId: id, status: 'PENDING' } })) throw new AppException(409, 'STATE_CONFLICT', 'Permintaan batal atau sengketa sudah terbuka.');
      await invalidateHandover(tx, id, 'CANCELLATION_REQUESTED', actorId);
      const request = await tx.cancellationRequest.create({ data: { transactionId: id, requestedById: actorId, reason: input.reason } });
      await notifyTransaction(tx, row, 'CANCELLATION_REQUESTED', `cancellation:${request.id}:requested`, actorId);
      await tx.transaction.update({ where: { id }, data: { version: { increment: 1 } } });
      return transactionDto(tx, await tx.transaction.findUniqueOrThrow({ where: { id } }));
    });
  }

  async respondCancel(actorId: string, id: string, requestId: string, input: { expectedVersion: number; accept: boolean }, key?: string) {
    validId(requestId);
    return idempotent(this.db, actorId, 'cancel-respond:' + id + ':' + requestId, key, input, async (tx) => {
      const row = await lockTransaction(tx, id); participant(row, actorId); mutable(row, input.expectedVersion);
      const request = await tx.cancellationRequest.findUnique({ where: { id: requestId } });
      if (!request || request.transactionId !== id || request.requestedById === actorId) throw new AppException(403, 'FORBIDDEN', 'Hanya pihak lain yang dapat menjawab permintaan ini.');
      if (request.status !== 'PENDING' || row.status === 'DISPUTED') throw new AppException(409, 'STATE_CONFLICT', 'Permintaan tidak dapat dijawab.');
      await tx.cancellationRequest.update({ where: { id: requestId }, data: { status: input.accept ? 'ACCEPTED' : 'REJECTED', respondedById: actorId, respondedAt: new Date(), endReason: input.accept ? 'BOTH_PARTIES_AGREED' : 'OTHER_PARTY_REJECTED' } });
      if (input.accept) await this.cancel(tx, row);
      else {
        await tx.transaction.update({ where: { id }, data: { version: { increment: 1 } } });
        await notifyTransaction(tx, row, 'CANCELLATION_REJECTED', `cancellation:${request.id}:rejected`, actorId);
      }
      return transactionDto(tx, await tx.transaction.findUniqueOrThrow({ where: { id } }));
    });
  }

  async cancel(tx: Prisma.TransactionClient, row: Transaction): Promise<void> {
    if (!activeTransactionStatuses.includes(row.status as typeof activeTransactionStatuses[number])) throw new AppException(409, 'STATE_CONFLICT', 'Transaksi sudah berakhir.');
    const snapshot = row.snapshot as unknown as TransactionSnapshot;
    for (const item of snapshot.items) {
      const changed = await tx.item.updateMany({ where: { id: item.id, reservedByTransactionId: row.id, currentOwnerId: item.fromUserId }, data: { reservedByTransactionId: null, version: { increment: 1 } } });
      if (changed.count !== 1) throw new AppException(409, 'STATE_CONFLICT', 'Reservasi tidak sesuai.');
    }
    const listing = await tx.listing.findUniqueOrThrow({ where: { id: row.listingId } });
    let status: 'ACTIVE' | 'PAUSED' | 'SUSPENDED' = listing.status === 'SUSPENDED' ? 'SUSPENDED' : 'PAUSED';
    if (listing.status === 'RESERVED' && listing.currentRevisionId === snapshot.listingRevisionId) {
      try {
        const account = await tx.user.findUniqueOrThrow({ where: { id: row.sellerOrDonorId } });
        const data = await eligible(tx, row.itemId, row.sellerOrDonorId, row.type, snapshot.items[0].assessmentId);
        const photos = await tx.mediaAsset.count({ where: { id: { in: snapshot.items[0].mediaIds }, deletedAt: null, caseId: null } });
        if (account.status === 'ACTIVE' && account.emailVerifiedAt && data.item.itemRevision === snapshot.items[0].itemRevision && photos === snapshot.items[0].mediaIds.length) status = 'ACTIVE';
      } catch (error) { if (!(error instanceof AppException)) throw error; }
    }
    const now = new Date();
    await tx.listing.update({ where: { id: row.listingId }, data: { status, publishedAt: status === 'ACTIVE' ? now : null, version: { increment: 1 } } });
    await tx.cancellationRequest.updateMany({ where: { transactionId: row.id, status: 'PENDING' }, data: { status: 'ACCEPTED', endReason: 'ADMIN_CANCELLED', respondedAt: now } });
    await invalidateHandover(tx, row.id, 'TRANSACTION_CANCELLED');
    await tx.transaction.update({ where: { id: row.id }, data: { status: 'CANCELLED', cancelledAt: now, version: { increment: 1 } } });
    await notifyTransaction(tx, row, 'TRANSACTION_CANCELLED', `transaction:${row.id}:cancelled`);
  }

  async dispute(actorId: string, id: string, input: { expectedVersion: number; reason: string }, key?: string) {
    return idempotent(this.db, actorId, 'dispute:' + id, key, input, async (tx) => {
      const row = await lockTransaction(tx, id); participant(row, actorId); mutable(row, input.expectedVersion);
      if (row.status === 'DISPUTED') throw new AppException(409, 'STATE_CONFLICT', 'Sengketa sudah terbuka.');
      await invalidateHandover(tx, id, 'DISPUTE_OPENED', actorId);
      const dispute = await tx.disputeCase.create({ data: { transactionId: id, openedById: actorId, reason: input.reason } });
      await tx.caseEvidence.create({ data: { caseId: dispute.id, submittedById: actorId, note: input.reason } });
      await notifyTransaction(tx, row, 'DISPUTE_OPENED', `dispute:${dispute.id}:opened`, actorId);
      await tx.transaction.update({ where: { id }, data: { status: 'DISPUTED', version: { increment: 1 } } });
      return transactionDto(tx, await tx.transaction.findUniqueOrThrow({ where: { id } }));
    });
  }

  async reminders(now = new Date()): Promise<void> {
    const rows = await this.db.transaction.findMany({ where: { status: { in: [...activeTransactionStatuses] } } });
    for (const ref of rows) await serial(this.db, async tx => {
      const row = await tx.transaction.findUniqueOrThrow({ where: { id: ref.id } });
      if (!activeTransactionStatuses.includes(row.status as typeof activeTransactionStatuses[number])) return;
      const age = now.getTime() - row.acceptedAt.getTime();
      const title = (row.snapshot as unknown as TransactionSnapshot).items[0].title;
      for (const milestone of [7, 12]) if (!row.agreedHandoverId && row.status !== 'DISPUTED' && age >= milestone * day) for (const userId of [row.sellerOrDonorId, row.buyerOrRecipientId]) {
        await notify(tx, 'HANDOVER_REMINDER', 'handover:' + row.id + ':' + milestone, [userId], { transactionId: row.id, title, day: milestone });
      }
      if (now > row.targetHandoverAt) await tx.transaction.updateMany({ where: { id: row.id, status: { in: [...activeTransactionStatuses] }, overdueAt: null }, data: { overdueAt: now } });
    });
  }
}
