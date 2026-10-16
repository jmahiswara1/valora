import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { notificationTypes, uuidSchema, type NotificationCenterDto, type NotificationSummaryDto, type NotificationsQuery } from '@valora/contracts';
import type { InAppNotification, Prisma } from '../../generated/prisma/client.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { AppException } from '../../shared/http.js';
import { serial, validId } from '../../shared/transactions.js';
import { expireOffers } from './events.js';

const payloadSchema = z.object({ proposalId: uuidSchema.optional(), leadMinutes: z.number().int().positive().optional(), title: z.string(), offerId: uuidSchema.optional(), transactionId: uuidSchema.optional(), listingId: uuidSchema.optional(), day: z.number().optional(), conversationId: uuidSchema.optional(), latestMessageSequence: z.number().int().positive().optional() });
const copy = {
  EXCHANGE_CASH_CONFIRMED: ['Tambahan uang dikonfirmasi', 'Pihak lain melaporkan penyerahan atau penerimaan tambahan uang Exchange.'],
  HANDOVER_PROPOSED: ['Usulan serah terima', 'Pihak lain mengajukan koordinasi. Periksa dan beri tanggapan.'],
  HANDOVER_APPROVED: ['Koordinasi disepakati', 'Jadwal dan detail serah terima telah disepakati.'],
  HANDOVER_REJECTED: ['Usulan ditolak', 'Pihak lain menolak usulan koordinasi serah terima.'],
  HANDOVER_WITHDRAWN: ['Usulan ditarik', 'Pengusul telah menarik koordinasi serah terima.'],
  HANDOVER_EXPIRED: ['Waktu usulan terlewati', 'Ajukan jadwal baru dalam tenggat transaksi.'],
  SHIPMENT_UPDATED: ['Informasi pengiriman', 'Pengirim telah mencatat atau memperbaiki kurir dan resi.'],
  MESSAGE_RECEIVED: ['Pesan baru', 'Ada pesan baru dalam percakapanmu.'],
  REVIEW_RECEIVED: ['Ulasan baru', 'Pengalaman transaksi denganmu sudah diulas.'],
  REVIEW_REPLY_RECEIVED: ['Balasan ulasan', 'Pihak lain telah membalas ulasanmu.'],
  OFFER_RECEIVED: ['Penawaran baru', 'Ada penawaran yang menunggu tanggapanmu.'],
  OFFER_COUNTERED: ['Balasan penawaran', 'Ada usulan baru untuk penawaranmu.'],
  OFFER_REJECTED: ['Penawaran ditolak', 'Pihak lain tidak melanjutkan penawaran ini.'],
  OFFER_WITHDRAWN: ['Penawaran ditarik', 'Pengirim telah menarik penawarannya.'],
  OFFER_EXPIRED: ['Penawaran berakhir', 'Masa penawaran atau kelayakan barang telah berubah.'],
  TRANSACTION_STARTED: ['Kesepakatan dimulai', 'Penawaran disepakati. Atur serah terima bersama.'],
  HANDOVER_CONFIRMED: ['Serah terima dikonfirmasi', 'Pihak lain telah mencatat konfirmasi serah terima.'],
  TRANSACTION_COMPLETED: ['Transaksi selesai', 'Serah terima selesai dan kepemilikan telah tercatat.'],
  CANCELLATION_REQUESTED: ['Permintaan pembatalan', 'Pihak lain meminta pembatalan. Periksa dan beri tanggapan.'],
  CANCELLATION_REJECTED: ['Pembatalan ditolak', 'Pihak lain menolak permintaan pembatalan.'],
  TRANSACTION_CANCELLED: ['Transaksi dibatalkan', 'Kesepakatan ini telah dibatalkan.'],
  DISPUTE_OPENED: ['Transaksi dalam peninjauan', 'Transaksi memerlukan tindak lanjut melalui peninjauan.'],
  DISPUTE_CONTINUED: ['Transaksi dapat dilanjutkan', 'Peninjauan selesai. Lanjutkan proses serah terima.'],
  SAVED_SEARCH_MATCH: ['Barang baru yang cocok', 'Ada barang baru sesuai pencarian tersimpanmu.'],
  HANDOVER_REMINDER: ['Pengingat serah terima', 'Periksa serah terima dan konfirmasi transaksi.'],
} as const;
const offers = notificationTypes.filter(type => type.startsWith('OFFER_'));
const cursorSchema = z.object({ at: z.iso.datetime(), id: uuidSchema, status: z.enum(['all', 'unread']), category: z.enum(['all', 'offers', 'transactions', 'market', 'messages']) });

function dto(row: InAppNotification): NotificationCenterDto {
  const type = z.enum(notificationTypes).parse(row.type), payload = payloadSchema.parse(row.payload);
  const category = type === 'MESSAGE_RECEIVED' ? 'messages' : type === 'SAVED_SEARCH_MATCH' ? 'market' : type.startsWith('OFFER_') ? 'offers' : 'transactions';
  const id = category === 'messages' ? payload.conversationId : category === 'market' ? payload.listingId : category === 'offers' ? payload.offerId : payload.transactionId;
  if (!id) throw new Error('Notification target missing');
  return { id: row.id, type, category, title: copy[type][0], message: type === 'HANDOVER_REMINDER' && payload.day ? `Pengingat hari ke-${payload.day}. ${copy[type][1]}` : type === 'HANDOVER_REMINDER' && payload.leadMinutes ? `Jadwal serah terima dalam ${payload.leadMinutes === 1440 ? '24' : '2'} jam. ${copy[type][1]}` : copy[type][1],
    itemTitle: payload.title, target: { kind: category === 'messages' ? 'CONVERSATION' : category === 'market' ? 'LISTING' : category === 'offers' ? 'OFFER' : 'TRANSACTION', id }, ...(type === 'MESSAGE_RECEIVED' ? { latestMessageSequence: payload.latestMessageSequence } : {}), createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null };
}

@Injectable()
export class NotificationService {
  constructor(private readonly db: DatabaseService) {}

  async list(userId: string, query: NotificationsQuery) {
    let boundary: Prisma.InAppNotificationWhereInput = {};
    if (query.cursor) {
      try {
        const c = cursorSchema.parse(JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')));
        if (c.status !== query.status || c.category !== query.category) throw new Error('Different filter');
        boundary = { OR: [{ createdAt: { lt: new Date(c.at) } }, { createdAt: new Date(c.at), id: { lt: c.id } }] };
      } catch { throw new AppException(400, 'INVALID_INPUT', 'Cursor notifikasi tidak valid.'); }
    }
    const rows = await this.db.inAppNotification.findMany({ where: { userId, type: { in: query.category === 'messages' ? ['MESSAGE_RECEIVED'] : query.category === 'offers' ? offers : query.category === 'market' ? ['SAVED_SEARCH_MATCH'] : query.category === 'transactions' ? notificationTypes.filter(t => !offers.includes(t) && t !== 'SAVED_SEARCH_MATCH' && t !== 'MESSAGE_RECEIVED') : [...notificationTypes] },
      ...(query.status === 'unread' ? { readAt: null } : {}), AND: [boundary] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit + 1 });
    const page = rows.slice(0, query.limit), last = page.at(-1);
    return { data: page.map(dto), meta: { nextCursor: rows.length > query.limit && last ? Buffer.from(JSON.stringify({ at: last.createdAt.toISOString(), id: last.id, status: query.status, category: query.category })).toString('base64url') : null } };
  }

  async summary(userId: string): Promise<NotificationSummaryDto> {
    // A consistent snapshot keeps the preview and total in agreement.
    return this.db.$transaction(async tx => {
      const where = { userId, type: { in: [...notificationTypes] } };
      const unreadCount = await tx.inAppNotification.count({ where: { ...where, readAt: null } });
      const recent = await tx.inAppNotification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 5 });
      return { unreadCount, recent: recent.map(dto) };
    }, { isolationLevel: 'RepeatableRead' });
  }

  async read(userId: string, id: string, throughSequence?: number) {
    validId(id);
    return serial(this.db, async tx => {
      const row = await tx.inAppNotification.findFirst({ where: { id, userId } });
      if (!row) throw new AppException(404, 'NOT_FOUND', 'Notifikasi tidak ditemukan.');
      const latest = (row.payload as { latestMessageSequence?: number }).latestMessageSequence;
      if (row.type === 'MESSAGE_RECEIVED' && !row.readAt && (throughSequence === undefined || latest === undefined || throughSequence < latest)) return { read: false, readAt: null };
      const readAt = row.readAt ?? new Date();
      if (!row.readAt) await tx.inAppNotification.update({ where: { id }, data: { readAt } });
      return { read: true, readAt: readAt.toISOString() };
    });
  }

  async readAll(userId: string) {
    return serial(this.db, async tx => {
      const readAt = new Date();
      const changed = await tx.inAppNotification.updateMany({ where: { userId, readAt: null }, data: { readAt } });
      return { read: true, count: changed.count, readAt: readAt.toISOString() };
    });
  }

  async expire(now = new Date()) {
    // Bounded batches avoid holding the domain write gate over an unbounded backlog.
    return serial(this.db, async tx => {
      const rows = await tx.offer.findMany({ where: { status: { in: ['PENDING', 'COUNTERED'] }, expiresAt: { lte: now } }, orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }], take: 100, select: { id: true } });
      await expireOffers(tx, { id: { in: rows.map(r => r.id) }, expiresAt: { lte: now } }, 'TIMEOUT');
    });
  }
}
