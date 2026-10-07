import { Prisma } from '../../generated/prisma/client.js';
import type { TransactionTimelineDto } from '@valora/contracts';
import { AppException } from '../../shared/http.js';

const labels: Record<string, string> = {
  TRANSACTION_STARTED: 'Penawaran disepakati', HANDOVER_PROPOSED: 'Koordinasi serah terima diajukan', HANDOVER_APPROVED: 'Koordinasi serah terima disepakati', HANDOVER_REJECTED: 'Usulan koordinasi ditolak', HANDOVER_WITHDRAWN: 'Usulan koordinasi ditarik', HANDOVER_EXPIRED: 'Waktu usulan terlewati', HANDOVER_INVALIDATED: 'Usulan koordinasi ditutup', SHIPMENT_UPDATED: 'Informasi pengiriman dicatat', HANDED_OVER: 'Penyerahan barang dikonfirmasi', RECEIVED: 'Penerimaan barang dikonfirmasi', CANCELLATION_REQUESTED: 'Pembatalan diminta', CANCELLATION_RESPONDED: 'Permintaan pembatalan ditanggapi', DISPUTE_OPENED: 'Sengketa dibuka', DISPUTE_RESOLVED: 'Putusan sengketa dicatat', TRANSACTION_COMPLETED: 'Transaksi selesai', TRANSACTION_CANCELLED: 'Transaksi dibatalkan', CORRECTION_OPENED: 'Koreksi riwayat dibuka', CORRECTION_RESOLVED: 'Putusan koreksi dicatat',
};
export async function timeline(tx: Prisma.TransactionClient, id: string, query: { limit: number; cursor?: string }) {
  let boundary = Prisma.empty;
  if (query.cursor) {
    try {
      const cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString()) as { transactionId: string; at: string; id: string };
      const at = new Date(cursor.at);
      if (cursor.transactionId !== id || !Number.isFinite(at.getTime()) || typeof cursor.id !== 'string' || cursor.id.length > 100) throw new Error('cursor');
      boundary = Prisma.sql`WHERE at < ${at} OR (at = ${at} AND event_id < ${cursor.id})`;
    } catch { throw new AppException(400, 'INVALID_INPUT', 'Cursor linimasa tidak sesuai transaksi.'); }
  }
  const rows = await tx.$queryRaw<{ event_id: string; type: string; actor_id: string | null; proposal_id: string | null; item_id: string | null; at: Date }[]>(Prisma.sql`
    WITH history AS (
      SELECT 'start:' || id::text AS event_id, 'TRANSACTION_STARTED' AS type, NULL::uuid AS actor_id, NULL::uuid AS proposal_id, NULL::uuid AS item_id, "acceptedAt" AS at FROM "Transaction" WHERE id = ${id}::uuid
      UNION ALL SELECT 'coord:' || id::text, type, "actorId", "proposalId", "itemId", "occurredAt" FROM "HandoverEvent" WHERE "transactionId" = ${id}::uuid
      UNION ALL SELECT 'confirm:' || id::text, kind, "actorId", NULL::uuid, "itemId", "confirmedAt" FROM "HandoverConfirmation" WHERE "transactionId" = ${id}::uuid
      UNION ALL SELECT 'cancel-request:' || id::text, 'CANCELLATION_REQUESTED', "requestedById", NULL::uuid, NULL::uuid, "createdAt" FROM "CancellationRequest" WHERE "transactionId" = ${id}::uuid
      UNION ALL SELECT 'cancel-response:' || id::text, 'CANCELLATION_RESPONDED', "respondedById", NULL::uuid, NULL::uuid, "respondedAt" FROM "CancellationRequest" WHERE "transactionId" = ${id}::uuid AND "respondedAt" IS NOT NULL
      UNION ALL SELECT 'dispute:' || id::text, 'DISPUTE_OPENED', "openedById", NULL::uuid, NULL::uuid, "createdAt" FROM "DisputeCase" WHERE "transactionId" = ${id}::uuid
      UNION ALL SELECT 'dispute-resolved:' || id::text, 'DISPUTE_RESOLVED', NULL::uuid, NULL::uuid, NULL::uuid, "resolvedAt" FROM "DisputeCase" WHERE "transactionId" = ${id}::uuid AND "resolvedAt" IS NOT NULL
      UNION ALL SELECT 'complete:' || id::text, 'TRANSACTION_COMPLETED', NULL::uuid, NULL::uuid, NULL::uuid, "completedAt" FROM "Transaction" WHERE id = ${id}::uuid AND "completedAt" IS NOT NULL
      UNION ALL SELECT 'cancelled:' || id::text, 'TRANSACTION_CANCELLED', NULL::uuid, NULL::uuid, NULL::uuid, "cancelledAt" FROM "Transaction" WHERE id = ${id}::uuid AND "cancelledAt" IS NOT NULL
      UNION ALL SELECT 'correction:' || id::text, 'CORRECTION_OPENED', NULL::uuid, NULL::uuid, NULL::uuid, "createdAt" FROM "CorrectionCase" WHERE "transactionId" = ${id}::uuid
      UNION ALL SELECT 'correction-resolved:' || id::text, 'CORRECTION_RESOLVED', NULL::uuid, NULL::uuid, NULL::uuid, "resolvedAt" FROM "CorrectionCase" WHERE "transactionId" = ${id}::uuid AND "resolvedAt" IS NOT NULL
    ) SELECT * FROM history ${boundary} ORDER BY at DESC, event_id DESC LIMIT ${query.limit + 1}
  `);
  const page = rows.slice(0, query.limit), last = page.at(-1);
  const data: TransactionTimelineDto[] = page.map(row => ({ id: row.event_id, type: row.type, actorId: row.actor_id, proposalId: row.proposal_id, itemId: row.item_id, label: labels[row.type] ?? 'Perubahan transaksi dicatat', occurredAt: row.at.toISOString() }));
  return { data, meta: { nextCursor: rows.length > query.limit && last ? Buffer.from(JSON.stringify({ transactionId: id, at: last.at.toISOString(), id: last.event_id })).toString('base64url') : null } };
}
