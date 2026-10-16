import type { NotificationType, TransactionSnapshot } from '@valora/contracts';
import type { Prisma, Transaction } from '../../generated/prisma/client.js';
import { requestContext } from '../../shared/request-context.js';
import { expandOfferItems } from '../../shared/exchange.js';

type Payload = { title: string; offerId?: string; transactionId?: string; listingId?: string; day?: number; proposalId?: string; leadMinutes?: number };

export async function notifyMessage(tx: Prisma.TransactionClient, userId: string, conversationId: string, messageId: string, sequence: number, title: string) {
  if (!await tx.user.findFirst({ where: { id: userId, status: 'ACTIVE' } })) return;
  const row = await tx.inAppNotification.findFirst({ where: { userId, conversationId, type: 'MESSAGE_RECEIVED', readAt: null } });
  const data = { payload: { title, conversationId, latestMessageSequence: sequence }, createdAt: new Date() };
  if (row) await tx.inAppNotification.update({ where: { id: row.id }, data });
  else await tx.inAppNotification.create({ data: { ...data, userId, conversationId, type: 'MESSAGE_RECEIVED', eventKey: `message:${messageId}:${userId}` } });
}

// All callers run inside the domain transaction and its serial write gate.
export async function notify(tx: Prisma.TransactionClient, type: Exclude<NotificationType, 'MESSAGE_RECEIVED'>, event: string, recipients: string[], payload: Payload, exclude?: string) {
  const ids = [...new Set(recipients)].filter(id => id !== exclude);
  if (!ids.length) return 0;
  const users = await tx.user.findMany({ where: { id: { in: ids }, status: 'ACTIVE' }, select: { id: true } });
  let created = 0;
  for (const { id: userId } of users) {
    const eventKey = `${event}:${userId}`;
    if (!await tx.inAppNotification.count({ where: { eventKey } })) created++;
    await tx.inAppNotification.upsert({ where: { eventKey }, update: {}, create: { userId, eventKey, type, payload: { ...payload }, createdAt: new Date() } });
  }
  return created;
}

export async function notifyTransaction(tx: Prisma.TransactionClient, row: Transaction, type: Exclude<NotificationType, 'MESSAGE_RECEIVED'>, event: string, exclude?: string) {
  const snapshot = row.snapshot as unknown as TransactionSnapshot;
  await notify(tx, type, event, [row.sellerOrDonorId, row.buyerOrRecipientId], { transactionId: row.id, title: snapshot.items[0].title }, exclude);
}

// Shared by every domain path which expires offers. Only changed rows emit events.
export async function expireOffers(tx: Prisma.TransactionClient, where: Prisma.OfferWhereInput, reason: string) {
  const rows = await tx.offer.findMany({ where: { AND: [expandOfferItems(where), { status: { in: ['PENDING', 'COUNTERED'] } }] },
    include: { listing: { select: { ownerId: true } }, listingRevision: { select: { title: true } } } });
  for (const row of rows) {
    const changed = await tx.offer.updateMany({ where: { id: row.id, version: row.version, status: { in: ['PENDING', 'COUNTERED'] } }, data: { status: 'EXPIRED', endReason: reason, version: { increment: 1 } } });
    if (changed.count) await notify(tx, 'OFFER_EXPIRED', `offer:${row.id}:expired:${row.version + 1}`, [row.bidderId, row.listing.ownerId],
      { offerId: row.id, title: row.listingRevision.title }, reason === 'TIMEOUT' ? undefined : requestContext.getStore()?.actor?.id);
  }
}
