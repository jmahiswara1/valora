import { createHash } from 'node:crypto';
import type { ExchangeTerms, TransactionItemSnapshot, TransactionSnapshot } from '@valora/contracts';
import type { Prisma, Transaction } from '../generated/prisma/client.js';
import { AppException } from './http.js';
import { eligible } from './transactions.js';

export type ExchangeListing = Prisma.ListingGetPayload<{ include: { currentRevision: { include: { media: true } } } }>;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function exchangeHash(terms: ExchangeTerms) { return createHash('sha256').update(canonical(terms)).digest('hex'); }
export function advancedExchange(terms: ExchangeTerms) { return terms.ownerItems.length !== 1 || terms.bidderItems.length !== 1 || terms.cashAdjustment !== null; }
export function exchangeItems(terms: ExchangeTerms) { return [...terms.ownerItems, ...terms.bidderItems]; }

export async function exchangeSnapshot(tx: Prisma.TransactionClient, id: string, fromUserId: string, toUserId: string, listing: ExchangeListing): Promise<TransactionItemSnapshot> {
  const { item, assessment } = await eligible(tx, id, fromUserId, 'EXCHANGE');
  if (item.reservedByTransactionId || item.archivedAt) throw new AppException(409, 'ITEM_RESERVED', 'Barang sudah direservasi atau diarsipkan.');
  const anchor = id === listing.itemId;
  if (!anchor && await tx.listing.findFirst({ where: { itemId: id, status: { in: ['ACTIVE', 'RESERVED'] } } })) throw new AppException(409, 'STATE_CONFLICT', 'Tarik Listing aktif barang tambahan sebelum menggunakannya untuk Exchange.');
  const revision = listing.currentRevision;
  if (anchor && (!revision || revision.itemRevision !== item.itemRevision || revision.assessmentId !== assessment.id)) throw new AppException(409, 'STATE_CONFLICT', 'Barang utama atau penilaiannya sudah berubah.');
  const mediaIds = anchor ? revision!.media.map(photo => photo.mediaId) : (await tx.mediaAsset.findMany({ where: { itemId: id, deletedAt: null, caseId: null, repairRecordId: null, evidenceId: null, OR: [{ uploadedById: fromUserId }, { shareWithFutureOwner: true }] }, orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }] })).map(photo => photo.id);
  if (!mediaIds.length) throw new AppException(422, 'ACTION_NEEDS_DATA', 'Setiap barang Exchange memerlukan foto.');
  return { id, itemRevision: item.itemRevision, assessmentId: assessment.id, title: anchor ? revision!.title : item.title, description: anchor ? revision!.description : item.description,
    conditionSummary: anchor ? revision!.conditionDisclosure : item.conditionSummary, categoryCode: item.categoryCode, subcategoryCode: item.subcategoryCode,
    estimatedWeightGrams: item.estimatedWeightGrams, mediaIds, fromUserId, toUserId };
}

export async function validateExchange(tx: Prisma.TransactionClient, terms: ExchangeTerms, listing: ExchangeListing, bidderId: string) {
  const items = exchangeItems(terms);
  if (terms.ownerItems.length < 1 || terms.ownerItems.length > 3 || terms.bidderItems.length < 1 || terms.bidderItems.length > 3 ||
    terms.ownerItems[0].id !== listing.itemId || new Set(items.map(item => item.id)).size !== items.length) throw new AppException(409, 'STATE_CONFLICT', 'Paket Exchange tidak sesuai. Kirim ulang penawaran.');
  for (const [side, from, to] of [[terms.ownerItems, listing.ownerId, bidderId], [terms.bidderItems, bidderId, listing.ownerId]] as const) for (const snapshot of side) {
    if (snapshot.fromUserId !== from || snapshot.toUserId !== to) throw new AppException(409, 'STATE_CONFLICT', 'Pihak kesepakatan berubah.');
    const { item, assessment, rubric } = await eligible(tx, snapshot.id, from, 'EXCHANGE', snapshot.assessmentId);
    if (item.reservedByTransactionId || item.itemRevision !== snapshot.itemRevision || assessment.id !== snapshot.assessmentId) throw new AppException(409, 'STATE_CONFLICT', 'Barang atau penilaian dalam paket sudah berubah.');
    if (snapshot.id === listing.itemId) {
      if (listing.currentRevision?.itemRevision !== item.itemRevision || listing.currentRevision?.rubricVersionId !== rubric.id) throw new AppException(409, 'STATE_CONFLICT', 'Listing atau rubrik sudah berubah.');
    } else if (await tx.listing.findFirst({ where: { itemId: item.id, status: { in: ['ACTIVE', 'RESERVED'] } } })) throw new AppException(409, 'STATE_CONFLICT', 'Barang tambahan memiliki Listing aktif.');
    if (!snapshot.mediaIds.length || await tx.mediaAsset.count({ where: { id: { in: snapshot.mediaIds }, itemId: snapshot.id, deletedAt: null, caseId: null, repairRecordId: null, evidenceId: null, OR: [{ uploadedById: from }, { shareWithFutureOwner: true }] } }) !== snapshot.mediaIds.length) throw new AppException(422, 'ACTION_NEEDS_DATA', 'Foto barang dalam kesepakatan tidak lagi tersedia.');
  }
}

export function transactionUsingItem(itemId: string): Prisma.TransactionWhereInput { return { OR: [{ items: { some: { itemId } } }, { itemId }, { offeredItemId: itemId }] }; }
// Expand old expiration predicates centrally; only membership of the active revision counts.
export function expandOfferItems(input: Prisma.OfferWhereInput): Prisma.OfferWhereInput {
  const { exchangeItemId, AND, OR, NOT, ...rest } = input;
  const parts: Prisma.OfferWhereInput[] = [rest];
  if (AND) parts.push(...(Array.isArray(AND) ? AND : [AND]).map(expandOfferItems));
  if (OR) parts.push({ OR: OR.map(expandOfferItems) });
  if (NOT) parts.push({ NOT: (Array.isArray(NOT) ? NOT : [NOT]).map(expandOfferItems) });
  if (exchangeItemId !== undefined) {
    if (exchangeItemId === null) parts.push({ exchangeItemId });
    else parts.push({ OR: [{ currentRevision: { is: { items: { some: { itemId: exchangeItemId as unknown as string | Prisma.UuidFilter<'OfferRevisionItem'> } } } } }, { currentRevisionId: null, exchangeItemId }] });
  }
  return { AND: parts };
}

export function requiredCash(row: Transaction) {
  const adjustment = (row.snapshot as unknown as TransactionSnapshot).cashAdjustment;
  if (row.type !== 'EXCHANGE' || !adjustment) return [];
  const payer = adjustment.payer === 'OWNER' ? row.sellerOrDonorId : row.buyerOrRecipientId;
  const recipient = adjustment.payer === 'OWNER' ? row.buyerOrRecipientId : row.sellerOrDonorId;
  return [{ actorId: payer, kind: 'SENT' as const }, { actorId: recipient, kind: 'RECEIVED' as const }];
}
export async function cashReady(tx: Prisma.TransactionClient, row: Transaction) {
  const required = requiredCash(row);
  if (!required.length) return true;
  const confirmations = await tx.cashConfirmation.findMany({ where: { transactionId: row.id } });
  return required.every(need => confirmations.some(value => value.actorId === need.actorId && value.kind === need.kind));
}
