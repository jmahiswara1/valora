import { expireOffers } from '../notifications/events.js';
import type { Prisma } from '../../generated/prisma/client.js';

export async function pauseListingsForItem(tx: Prisma.TransactionClient, itemId: string, reason = 'LISTING_REVISED'): Promise<void> {
  const active = await tx.listing.findMany({ where: { itemId, status: { in: ['ACTIVE', 'PENDING_REVIEW'] } }, select: { id: true, status: true } });

  await expireOffers(tx, { exchangeItemId: itemId, status: { in: ['PENDING', 'COUNTERED'] } }, reason);
  const ids = active.map((listing) => listing.id);
  await tx.listing.updateMany({ where: { id: { in: ids }, status: { in: ['ACTIVE', 'PENDING_REVIEW'] } }, data: { status: 'PAUSED', version: { increment: 1 }, publishedAt: null } });
  await expireOffers(tx, { listingId: { in: ids }, status: { in: ['PENDING', 'COUNTERED'] } }, reason);
}
