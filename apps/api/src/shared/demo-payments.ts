import type { Transaction } from '../generated/prisma/client.js';
import type { TransactionSnapshot } from '@valora/contracts';

export function demoPaymentTerms(row: Transaction) {
  if (row.type === 'RESELL' && row.finalPriceIdr && row.finalPriceIdr > 0n) return { amountIdr: row.finalPriceIdr, payerId: row.buyerOrRecipientId, receiverId: row.sellerOrDonorId };
  const cash = (row.snapshot as unknown as TransactionSnapshot).cashAdjustment;
  if (row.type === 'EXCHANGE' && cash && cash.amountIdr > 0) return { amountIdr: BigInt(cash.amountIdr), payerId: cash.payer === 'OWNER' ? row.sellerOrDonorId : row.buyerOrRecipientId, receiverId: cash.payer === 'OWNER' ? row.buyerOrRecipientId : row.sellerOrDonorId };
  return null;
}
