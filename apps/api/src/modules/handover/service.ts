import { Injectable } from '@nestjs/common';
import type { HandoverDto, HandoverProposalInput, HandoverResponseInput, HandoverPrivateDetails, HandoverProposalDto, ShipmentDto, ShipmentInput, TransactionSnapshot, HandoverMutationDto } from '@valora/contracts';
import { DatabaseService } from '../../infrastructure/database.service.js';
import type { Prisma, Transaction, HandoverProposal, ShipmentRecord } from '../../generated/prisma/client.js';
import { AppException } from '../../shared/http.js';
import { idempotent, json, lockTransaction, mutable, participant, serial, validId, requiredConfirmations } from '../../shared/transactions.js';
import { notify } from '../notifications/events.js';
import { assignedCase } from '../disputes/helpers.js';
import { timeline } from './timeline.js';

export const proposalDto = (row: HandoverProposal): HandoverProposalDto => ({ id: row.id, transactionId: row.transactionId, proposedById: row.proposedById, method: row.method as HandoverProposalDto['method'], plannedAt: row.plannedAt.toISOString(), timeZone: row.timeZone as HandoverProposalDto['timeZone'], status: row.status as HandoverProposalDto['status'], endReason: row.endReason, privateDetails: row.purgedAt ? null : row.privateDetails as HandoverPrivateDetails | null, createdAt: row.createdAt.toISOString(), respondedAt: row.respondedAt?.toISOString() ?? null, respondedById: row.respondedById, purgedAt: row.purgedAt?.toISOString() ?? null });
export const shipmentDto = (row: ShipmentRecord): ShipmentDto => ({ id: row.id, proposalId: row.proposalId, itemId: row.itemId, senderId: row.senderId, courier: row.courier, trackingNumber: row.trackingNumber, reason: row.reason, revision: row.revision, recordedAt: row.recordedAt.toISOString(), purgedAt: row.purgedAt?.toISOString() ?? null });
function conflict(message: string): never { throw new AppException(409, 'STATE_CONFLICT', message); }
const snapshot = (row: Transaction) => row.snapshot as unknown as TransactionSnapshot;
const ownsDestination = (row: Transaction, actorId: string) => snapshot(row).items.some(item => item.toUserId === actorId);

@Injectable()
export class HandoverService {
  constructor(private readonly db: DatabaseService) {}

  private async row(tx: Prisma.TransactionClient, actorId: string, id: string) {
    validId(id); const row = await tx.transaction.findUnique({ where: { id } });
    if (!row) throw new AppException(404, 'NOT_FOUND', 'Transaksi tidak ditemukan.');
    participant(row, actorId); return row;
  }
  private async editable(tx: Prisma.TransactionClient, row: Transaction, now = new Date()): Promise<string | null> {
    if (row.status !== 'AWAITING_HANDOVER' || await tx.handoverConfirmation.count({ where: { transactionId: row.id } })) return 'Koordinasi dikunci setelah serah terima dimulai atau transaksi ditutup.';
    if (now >= row.targetHandoverAt) return 'Tenggat 14 hari telah terlewati.';
    if (await tx.cancellationRequest.count({ where: { transactionId: row.id, status: 'PENDING' } })) return 'Tanggapi permintaan pembatalan sebelum mengatur jadwal.';
    const users = await tx.user.findMany({ where: { id: { in: [row.sellerOrDonorId, row.buyerOrRecipientId] } } });
    if (users.length !== 2 || users.some(user => user.status !== 'ACTIVE' || !user.emailVerifiedAt)) return 'Kedua peserta harus aktif dan sudah memverifikasi email.';
    return null;
  }
  private date(row: Transaction, value: Date, now = new Date()) {
    if (value <= now || value > row.targetHandoverAt) throw new AppException(422, 'ACTION_NEEDS_DATA', 'Pilih waktu mendatang dalam tenggat 14 hari transaksi.');
  }
  private async event(tx: Prisma.TransactionClient, row: Transaction, type: string, proposalId: string, actorId: string | null, itemId?: string, now = new Date()) {
    return tx.handoverEvent.create({ data: { transactionId: row.id, type, proposalId, actorId, itemId, occurredAt: now } });
  }
  private async changed(tx: Prisma.TransactionClient, row: Transaction, id: string, status: string): Promise<HandoverMutationDto> {
    const current = await tx.transaction.update({ where: { id: row.id }, data: { version: { increment: 1 } } });
    return { id, transactionId: row.id, status, version: current.version };
  }
  private async alert(tx: Prisma.TransactionClient, row: Transaction, type: 'HANDOVER_PROPOSED' | 'HANDOVER_APPROVED' | 'HANDOVER_REJECTED' | 'HANDOVER_WITHDRAWN' | 'HANDOVER_EXPIRED' | 'SHIPMENT_UPDATED', eventId: string, proposalId: string, actorId?: string) {
    await notify(tx, type, 'coordination:' + eventId, [row.sellerOrDonorId, row.buyerOrRecipientId], { transactionId: row.id, title: snapshot(row).items[0].title, proposalId }, actorId);
  }
  private async read(tx: Prisma.TransactionClient, row: Transaction, actorId: string | null): Promise<HandoverDto> {
    const now = new Date();
    const [agreed, pending, confirmations] = await Promise.all([
      row.agreedHandoverId ? tx.handoverProposal.findUnique({ where: { id: row.agreedHandoverId } }) : null,
      tx.handoverProposal.findFirst({ where: { transactionId: row.id, status: 'PENDING' } }),
      tx.handoverConfirmation.findMany({ where: { transactionId: row.id } }),
    ]);
    const livePending = pending && pending.plannedAt > now ? pending : null;
    const reason = await this.editable(tx, row, now);
    const shipping = agreed?.method === 'DELIVERY' && !agreed.purgedAt;
    const users = await tx.user.findMany({ where: { id: { in: [row.sellerOrDonorId, row.buyerOrRecipientId] } } });
    const recordable = !users.some(user => user.status !== 'ACTIVE' || !user.emailVerifiedAt) && !await tx.cancellationRequest.count({ where: { transactionId: row.id, status: 'PENDING' } });
    const records = agreed?.method === 'DELIVERY' ? await tx.shipmentRecord.findMany({ where: { proposalId: agreed.id }, orderBy: { revision: 'desc' } }) : [];
    return {
      transactionId: row.id, version: row.version, deadlineAt: row.targetHandoverAt.toISOString(), serverTime: now.toISOString(), agreed: agreed ? proposalDto(agreed) : null, pending: livePending ? proposalDto(livePending) : null,
      directions: snapshot(row).items.map(item => {
        const received = confirmations.some(c => c.itemId === item.id && c.kind === 'RECEIVED');
        return { itemId: item.id, title: item.title, fromUserId: item.fromUserId, toUserId: item.toUserId, received, canRecord: Boolean(actorId && shipping && recordable && item.fromUserId === actorId && !received && ['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED'].includes(row.status)), shipment: records.find(record => record.itemId === item.id) ? shipmentDto(records.find(record => record.itemId === item.id)!) : null };
      }),
      permissions: { canPropose: Boolean(actorId && !reason && !livePending), canRespond: Boolean(actorId && !reason && livePending && livePending.proposedById !== actorId), canWithdraw: Boolean(actorId && livePending?.proposedById === actorId && !reason), reason: reason ?? (livePending ? 'Ada usulan yang menunggu tanggapan.' : null) },
    };
  }
  async get(actorId: string, id: string) { return serial(this.db, async tx => this.read(tx, await this.row(tx, actorId, id), actorId)); }
  async proposal(actorId: string, id: string, proposalId: string) {
    validId(proposalId); return serial(this.db, async tx => {
      await this.row(tx, actorId, id); const row = await tx.handoverProposal.findFirst({ where: { id: proposalId, transactionId: id } });
      if (!row) throw new AppException(404, 'NOT_FOUND', 'Usulan tidak ditemukan.'); return proposalDto(row);
    });
  }
  async shipments(actorId: string, id: string, proposalId: string, query: { limit: number; cursor?: string }) {
    validId(proposalId); if (query.cursor) validId(query.cursor);
    return serial(this.db, async tx => {
      await this.row(tx, actorId, id);
      if (!await tx.handoverProposal.count({ where: { id: proposalId, transactionId: id } })) throw new AppException(404, 'NOT_FOUND', 'Usulan tidak ditemukan.');
      const boundary = query.cursor ? await tx.shipmentRecord.findFirst({ where: { id: query.cursor, proposalId } }) : null;
      if (query.cursor && !boundary) throw new AppException(400, 'VALIDATION_ERROR', 'Cursor resi tidak sesuai usulan.');
      const rows = await tx.shipmentRecord.findMany({ where: { proposalId, ...(boundary ? { OR: [{ recordedAt: { lt: boundary.recordedAt } }, { recordedAt: boundary.recordedAt, id: { lt: boundary.id } }] } : {}) }, orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], take: query.limit + 1 });
      return { data: rows.slice(0, query.limit).map(shipmentDto), meta: { nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null } };
    });
  }
  async propose(actorId: string, id: string, input: HandoverProposalInput, key?: string) {
    return idempotent(this.db, actorId, 'handover-propose:' + id, key, input, async tx => {
      const row = await lockTransaction(tx, id); participant(row, actorId); mutable(row, input.expectedVersion);
      const reason = await this.editable(tx, row); if (reason) conflict(reason);
      await this.expire(tx, row, new Date());
      if (await tx.handoverProposal.count({ where: { transactionId: id, status: 'PENDING' } })) conflict('Tanggapi atau tarik usulan yang masih menunggu.');
      if (!snapshot(row).handoverMethods.includes(input.method)) throw new AppException(422, 'ACTION_NEEDS_DATA', 'Metode ini tidak tersedia dalam kesepakatan transaksi.');
      const plannedAt = new Date(input.plannedAt); this.date(row, plannedAt);
      const needsAddress = input.method === 'DELIVERY' && ownsDestination(row, actorId);
      if (Boolean(input.destination) !== needsAddress) throw new AppException(422, 'ACTION_NEEDS_DATA', needsAddress ? 'Lengkapi alamat barang yang akan kamu terima.' : 'Alamat hanya dapat diisi penerima barang.');
      const details: HandoverPrivateDetails = { location: input.location ?? null, note: input.note || null, responseReason: null, destinations: input.destination ? [{ userId: actorId, details: input.destination }] : [] };
      const proposal = await tx.handoverProposal.create({ data: { transactionId: id, proposedById: actorId, method: input.method, plannedAt, timeZone: input.timeZone, privateDetails: json(details) } });
      const event = await this.event(tx, row, 'HANDOVER_PROPOSED', proposal.id, actorId); await this.alert(tx, row, 'HANDOVER_PROPOSED', event.id, proposal.id, actorId);
      return this.changed(tx, row, proposal.id, proposal.status);
    });
  }
  async respond(actorId: string, id: string, proposalId: string, input: HandoverResponseInput, key?: string) {
    validId(proposalId); return idempotent(this.db, actorId, 'handover-respond:' + id + ':' + proposalId, key, input, async tx => {
      const row = await lockTransaction(tx, id); participant(row, actorId); mutable(row, input.expectedVersion);
      const reason = await this.editable(tx, row); if (reason) conflict(reason);
      const proposal = await tx.handoverProposal.findFirst({ where: { id: proposalId, transactionId: id, status: 'PENDING', purgedAt: null } });
      if (!proposal) conflict('Usulan ini tidak lagi menunggu tanggapan.');
      if (proposal.proposedById === actorId) throw new AppException(403, 'FORBIDDEN', 'Hanya pihak lain yang dapat menanggapi usulan.');
      this.date(row, proposal.plannedAt);
      const details = proposal.privateDetails as unknown as HandoverPrivateDetails;
      const needsAddress = input.accept && proposal.method === 'DELIVERY' && ownsDestination(row, actorId);
      if (Boolean(input.destination) !== needsAddress) throw new AppException(422, 'ACTION_NEEDS_DATA', needsAddress ? 'Lengkapi alamat penerimaan sebelum menyetujui.' : 'Alamat tidak dibutuhkan untuk tanggapan ini.');
      if (input.destination) details.destinations = [...details.destinations.filter(x => x.userId !== actorId), { userId: actorId, details: input.destination }];
      if (input.accept && proposal.method === 'DELIVERY' && snapshot(row).items.some(item => !details.destinations.some(address => address.userId === item.toUserId))) conflict('Alamat penerimaan kedua arah belum lengkap.');
      details.responseReason = input.accept ? null : input.reason!;
      const status = input.accept ? 'APPROVED' : 'REJECTED';
      await tx.handoverProposal.update({ where: { id: proposalId }, data: { status, privateDetails: json(details), respondedAt: new Date(), respondedById: actorId } });
      if (input.accept) await tx.transaction.update({ where: { id }, data: { agreedHandoverId: proposalId } });
      const type = input.accept ? 'HANDOVER_APPROVED' : 'HANDOVER_REJECTED';
      const event = await this.event(tx, row, type, proposalId, actorId); await this.alert(tx, row, type, event.id, proposalId, actorId);
      return this.changed(tx, row, proposalId, status);
    });
  }
  async withdraw(actorId: string, id: string, proposalId: string, expectedVersion: number, key?: string) {
    validId(proposalId); return idempotent(this.db, actorId, 'handover-withdraw:' + id + ':' + proposalId, key, { expectedVersion }, async tx => {
      const row = await lockTransaction(tx, id); participant(row, actorId); mutable(row, expectedVersion);
      const reason = await this.editable(tx, row); if (reason) conflict(reason);
      const proposal = await tx.handoverProposal.findFirst({ where: { id: proposalId, transactionId: id, status: 'PENDING', proposedById: actorId } });
      if (!proposal || proposal.plannedAt <= new Date()) conflict('Usulan tidak lagi dapat ditarik.');
      await tx.handoverProposal.update({ where: { id: proposalId }, data: { status: 'WITHDRAWN', respondedAt: new Date(), respondedById: actorId } });
      const event = await this.event(tx, row, 'HANDOVER_WITHDRAWN', proposalId, actorId); await this.alert(tx, row, 'HANDOVER_WITHDRAWN', event.id, proposalId, actorId);
      return this.changed(tx, row, proposalId, 'WITHDRAWN');
    });
  }
  async shipment(actorId: string, id: string, itemId: string, input: ShipmentInput, key?: string) {
    validId(itemId); return idempotent(this.db, actorId, 'shipment-update:' + id + ':' + itemId, key, input, async tx => {
      const row = await lockTransaction(tx, id); participant(row, actorId); mutable(row, input.expectedVersion);
      if (!['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED'].includes(row.status) || row.agreedHandoverId !== input.proposalId) conflict('Kesepakatan pengiriman sudah berubah atau transaksi ditahan.');
      if (await tx.cancellationRequest.count({ where: { transactionId: id, status: 'PENDING' } })) conflict('Tanggapi permintaan pembatalan sebelum mencatat resi.');
      const users = await tx.user.findMany({ where: { id: { in: [row.sellerOrDonorId, row.buyerOrRecipientId] } } });
      if (users.some(user => user.status !== 'ACTIVE' || !user.emailVerifiedAt)) conflict('Kedua peserta harus aktif dan sudah memverifikasi email.');
      const plan = await tx.handoverProposal.findFirst({ where: { id: input.proposalId, transactionId: id, status: 'APPROVED', method: 'DELIVERY', purgedAt: null } });
      const item = snapshot(row).items.find(item => item.id === itemId && item.fromUserId === actorId);
      if (!plan || !item) throw new AppException(403, 'FORBIDDEN', 'Hanya pengirim barang ini yang dapat mencatat resi.');
      if (await tx.handoverConfirmation.count({ where: { transactionId: id, itemId, kind: 'RECEIVED' } })) conflict('Penerimaan barang sudah dikonfirmasi.');
      const previous = await tx.shipmentRecord.findFirst({ where: { proposalId: plan.id, itemId }, orderBy: { revision: 'desc' } });
      if (previous && !input.reason) throw new AppException(422, 'ACTION_NEEDS_DATA', 'Tambahkan alasan perbaikan informasi pengiriman.');
      const record = await tx.shipmentRecord.create({ data: { proposalId: plan.id, itemId, senderId: actorId, courier: input.courier, trackingNumber: input.trackingNumber, reason: input.reason ?? null, revision: (previous?.revision ?? 0) + 1 } });
      const event = await this.event(tx, row, 'SHIPMENT_UPDATED', plan.id, actorId, itemId); await this.alert(tx, row, 'SHIPMENT_UPDATED', event.id, plan.id, actorId);
      return this.changed(tx, row, record.id, 'RECORDED');
    });
  }
  async history(actorId: string, id: string, query: { limit: number; cursor?: string }) { return serial(this.db, async tx => { await this.row(tx, actorId, id); return timeline(tx, id, query); }); }
  async admin(actorId: string, caseId: string, query: { limit: number; cursor?: string; shipmentCursor?: string }) {
    return serial(this.db, async tx => {
      const record = await assignedCase(tx, actorId, caseId, 'HANDOVER');
      if (query.cursor) validId(query.cursor); if (query.shipmentCursor) validId(query.shipmentCursor);
      const proposalBoundary = query.cursor ? await tx.handoverProposal.findFirst({ where: { id: query.cursor, transactionId: record.transactionId } }) : null;
      const shipmentBoundary = query.shipmentCursor ? await tx.shipmentRecord.findFirst({ where: { id: query.shipmentCursor, proposal: { transactionId: record.transactionId } } }) : null;
      if ((query.cursor && !proposalBoundary) || (query.shipmentCursor && !shipmentBoundary)) throw new AppException(400, 'VALIDATION_ERROR', 'Cursor riwayat tidak sesuai kasus.');
      const proposals = await tx.handoverProposal.findMany({ where: { transactionId: record.transactionId, ...(proposalBoundary ? { OR: [{ createdAt: { lt: proposalBoundary.createdAt } }, { createdAt: proposalBoundary.createdAt, id: { lt: proposalBoundary.id } }] } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit + 1 });
      const shipments = await tx.shipmentRecord.findMany({ where: { proposal: { transactionId: record.transactionId }, ...(shipmentBoundary ? { OR: [{ recordedAt: { lt: shipmentBoundary.recordedAt } }, { recordedAt: shipmentBoundary.recordedAt, id: { lt: shipmentBoundary.id } }] } : {}) }, orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], take: query.limit + 1 });
      const grant = await tx.caseAccessGrant.findFirstOrThrow({ where: { caseId, adminId: actorId, kind: 'HANDOVER', expiresAt: { gt: new Date() } }, orderBy: { expiresAt: 'desc' } });
      return { coordination: await this.read(tx, record.transaction, null), history: proposals.slice(0, query.limit).map(proposalDto), shipments: shipments.slice(0, query.limit).map(shipmentDto), accessExpiresAt: grant.expiresAt.toISOString(), nextCursor: proposals.length > query.limit ? proposals[query.limit - 1].id : null, shipmentNextCursor: shipments.length > query.limit ? shipments[query.limit - 1].id : null };
    });
  }
  private async expire(tx: Prisma.TransactionClient, row: Transaction, now: Date) {
    const proposals = await tx.handoverProposal.findMany({ where: { transactionId: row.id, status: 'PENDING', plannedAt: { lte: now } } });
    for (const proposal of proposals) {
      await tx.handoverProposal.update({ where: { id: proposal.id }, data: { status: 'EXPIRED', endReason: 'PLANNED_TIME_PASSED', respondedAt: now } });
      const event = await this.event(tx, row, 'HANDOVER_EXPIRED', proposal.id, null, undefined, now); await this.alert(tx, row, 'HANDOVER_EXPIRED', event.id, proposal.id);
    }
    return proposals.length;
  }
  async jobs(now = new Date()) {
    let expired = 0, reminders = 0;
    const rows = await this.db.transaction.findMany({ where: { OR: [{ handoverProposals: { some: { status: 'PENDING', plannedAt: { lte: now } } } }, { agreedHandoverId: { not: null }, status: { in: ['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED'] } }] }, select: { id: true } });
    for (const ref of rows) await serial(this.db, async tx => {
      const row = await lockTransaction(tx, ref.id); const count = await this.expire(tx, row, now); expired += count;
      if (count) await tx.transaction.update({ where: { id: row.id }, data: { version: { increment: 1 } } });
      if (!row.agreedHandoverId || !['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED'].includes(row.status)) return;
      const plan = await tx.handoverProposal.findUniqueOrThrow({ where: { id: row.agreedHandoverId } });
      if (plan.status !== 'APPROVED' || plan.purgedAt || plan.plannedAt <= now || !plan.respondedAt) return;
      const lead = [1440, 120].filter(minutes => { const at = plan.plannedAt.getTime() - minutes * 60000; return at >= plan.respondedAt!.getTime() && at <= now.getTime(); }).at(-1);
      if (!lead) return;
      const confirmations = await tx.handoverConfirmation.findMany({ where: { transactionId: row.id } });
      const recipients = [row.sellerOrDonorId, row.buyerOrRecipientId].filter(actorId => requiredConfirmations(row).some(required => required.actorId === actorId && !confirmations.some(c => c.actorId === actorId && c.itemId === required.itemId && c.kind === required.kind)));
      reminders += await notify(tx, 'HANDOVER_REMINDER', `handover-plan:${plan.id}:${lead}`, recipients, { transactionId: row.id, title: snapshot(row).items[0].title, proposalId: plan.id, leadMinutes: lead });
    });
    return { expired, reminders };
  }
}
