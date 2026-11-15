import { Injectable } from '@nestjs/common';
import type { DemoPaymentDto, DemoPaymentInput } from '@valora/contracts';
import type { Prisma, Transaction } from '../../generated/prisma/client.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { AppException } from '../../shared/http.js';
import { demoPaymentTerms } from '../../shared/demo-payments.js';
import { idempotent, lockTransaction, mutable, participant, requiredConfirmations, serial, validId } from '../../shared/transactions.js';
import { TransactionsService } from './service.js';

@Injectable()
export class DemoPaymentsService {
  constructor(private readonly db: DatabaseService, private readonly transactions: TransactionsService) {}
  private async row(tx: Prisma.TransactionClient, actorId: string, id: string) {
    validId(id); const row = await tx.transaction.findUnique({ where: { id } });
    if (!row) throw new AppException(404, 'NOT_FOUND', 'Transaksi tidak ditemukan.');
    participant(row, actorId); return row;
  }
  private async blocked(tx: Prisma.TransactionClient, row: Transaction) {
    if (!['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED'].includes(row.status)) return row.status === 'DISPUTED' ? 'Simulasi pembayaran ditahan selama sengketa.' : 'Transaksi sudah ditutup.';
    if (await tx.cancellationRequest.count({ where: { transactionId: row.id, status: 'PENDING' } })) return 'Tanggapi permintaan pembatalan sebelum melakukan simulasi pembayaran.';
    const users = await tx.user.findMany({ where: { id: { in: [row.sellerOrDonorId, row.buyerOrRecipientId] } } });
    if (users.length !== 2 || users.some(user => user.status !== 'ACTIVE' || !user.emailVerifiedAt)) return 'Kedua peserta harus aktif dan terverifikasi.';
    return null;
  }
  private async read(tx: Prisma.TransactionClient, row: Transaction, actorId: string): Promise<DemoPaymentDto> {
    const terms = demoPaymentTerms(row), payment = await tx.demoPayment.findUnique({ where: { transactionId: row.id } });
    const reason = terms && !payment ? await this.blocked(tx, row) : null;
    return { transactionId: row.id, mode: 'DEMO', method: 'QRIS', status: payment ? 'PAID' : terms ? 'UNPAID' : 'NOT_REQUIRED', amountIdr: Number(payment?.amountIdr ?? terms?.amountIdr ?? 0), payerId: payment?.payerId ?? terms?.payerId ?? null, receiverId: payment?.receiverId ?? terms?.receiverId ?? null, paidAt: payment?.paidAt.toISOString() ?? null, reference: payment?.id ?? null, version: row.version, canSimulate: Boolean(terms && !payment && !reason && terms.payerId === actorId), reason };
  }
  async get(actorId: string, id: string) { return serial(this.db, async tx => this.read(tx, await this.row(tx, actorId, id), actorId)); }
  async confirm(actorId: string, id: string, input: DemoPaymentInput, key?: string) {
    validId(id);
    return idempotent(this.db, actorId, 'demo-pay:' + id, key, input, async tx => {
      const row = await lockTransaction(tx, id); participant(row, actorId);
      const terms = demoPaymentTerms(row);
      if (!terms) throw new AppException(422, 'ACTION_INELIGIBLE', 'Transaksi ini tidak memerlukan pembayaran.');
      if (terms.payerId !== actorId) throw new AppException(403, 'FORBIDDEN', 'Hanya pihak pembayar yang dapat menjalankan simulasi.');
      if (await tx.demoPayment.count({ where: { transactionId: id } })) return this.read(tx, row, actorId);
      mutable(row, input.expectedVersion); const reason = await this.blocked(tx, row);
      if (reason) throw new AppException(409, 'STATE_CONFLICT', reason);
      // This record is a demo result. No bank, gateway, webhook or money transfer is called.
      await tx.demoPayment.create({ data: { transactionId: id, ...terms, method: 'QRIS', mode: 'DEMO' } });
      if (row.type === 'EXCHANGE' && await tx.handoverConfirmation.count({ where: { transactionId: id } }) === requiredConfirmations(row).length) await this.transactions.complete(tx, row, 'USER_CONFIRMED');
      else await tx.transaction.update({ where: { id }, data: { version: { increment: 1 } } });
      return this.read(tx, await tx.transaction.findUniqueOrThrow({ where: { id } }), actorId);
    });
  }
}
