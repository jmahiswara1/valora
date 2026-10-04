import type { Prisma } from '../../generated/prisma/client.js';
import { type MessageDto, type ConversationDto, uuidSchema, type MessageCreateInput } from '@valora/contracts';
import { Injectable, type MessageEvent } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { ProfilePhotoService } from '../profile/photo.service.js';
import { AppException } from '../../shared/http.js';
import { serial } from '../../shared/transactions.js';
import { Observable } from 'rxjs';
import { ConversationEvents } from "./events.js";

type ConversationRow = Prisma.ConversationGetPayload<{ include: { participantA: true; participantB: true; listing: { include: { currentRevision: true } }; messages: true } }>;

const messageDto = (row: { id: string; conversationId: string; senderId: string; body: string; clientMessageId: string; sentAt: Date }): MessageDto => ({ id: row.id, conversationId: row.conversationId, senderId: row.senderId, body: row.body, clientMessageId: row.clientMessageId, sentAt: row.sentAt.toISOString() });

const cursorEncode = (sequence: number) => Buffer.from(JSON.stringify({ sequence })).toString('base64url');

@Injectable()
export class ConversationsService {
  private readonly messageTimes = new Map<string, number[]>();
  constructor(private readonly db: DatabaseService, private readonly events: ConversationEvents, private readonly photos: ProfilePhotoService) {}

  private async assertCanMessage(userId: string, otherUserId: string, conversationId?: string) {
    const block = await this.db.userBlock.findFirst({ where: { revokedAt: null, OR: [{ blockerId: userId, blockedId: otherUserId }, { blockerId: otherUserId, blockedId: userId }] }, select: { id: true } });
    if (block) throw new AppException(403, 'FORBIDDEN', 'Pesan baru dibatasi oleh salah satu pihak.');
    const now = Date.now();
    const recent = (this.messageTimes.get(userId) ?? []).filter((timestamp) => now - timestamp < 5 * 60_000);
    if (recent.length >= 20) throw new AppException(429, 'RATE_LIMITED', 'Tunggu beberapa saat sebelum mengirim pesan lagi.');
    recent.push(now);
    this.messageTimes.set(userId, recent);
    if (this.messageTimes.size > 10_000) this.messageTimes.clear();
    void conversationId;
  }

  private async hasActiveBlock(tx: Prisma.TransactionClient, first: string, second: string) {
    return Boolean(await tx.userBlock.findFirst({ where: { revokedAt: null, OR: [{ blockerId: first, blockedId: second }, { blockerId: second, blockedId: first }] }, select: { id: true } }));
  }

  private async conversationRow(userId: string, id: string) {
    const row = await this.db.conversation.findUnique({ where: { id }, include: { participantA: true, participantB: true, listing: { include: { currentRevision: true } }, messages: { where: { deletedAt: null }, orderBy: { sequence: 'desc' }, take: 1 } } });
    if (!row || (row.participantAId !== userId && row.participantBId !== userId)) throw new AppException(404, 'NOT_FOUND', 'Percakapan tidak ditemukan.');
    return row;
  }

  private async toDto(row: ConversationRow, userId: string): Promise<ConversationDto> {
    const isA = row.participantAId === userId;
    const other = isA ? row.participantB : row.participantA;
    const readSequence = isA ? row.readSequenceA : row.readSequenceB;
    const unreadCount = await this.db.message.count({ where: { conversationId: row.id, senderId: { not: userId }, sequence: { gt: readSequence }, deletedAt: null } });
    const transaction = await this.db.transaction.findFirst({ where: { listingId: row.listingId, OR: [{ sellerOrDonorId: userId, buyerOrRecipientId: other.id }, { sellerOrDonorId: other.id, buyerOrRecipientId: userId }] }, orderBy: { acceptedAt: 'desc' }, select: { id: true } });
    const profilePhotoUrl = await this.photos.urlFor(other.id);
    return { id: row.id, transactionId: transaction?.id ?? null, listingId: row.listingId, listingTitle: row.listing.currentRevision?.title ?? 'Listing', participant: { id: other.id, displayName: other.displayName, profilePhotoUrl }, lastMessage: row.messages[0] ? messageDto(row.messages[0]) : null, unreadCount, updatedAt: row.updatedAt.toISOString() };
  }

  async open(userId: string, listingId: string): Promise<ConversationDto> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
    if (!user?.emailVerifiedAt) throw new AppException(403, 'EMAIL_UNVERIFIED', 'Verifikasi email sebelum memulai percakapan.');
    if (!uuidSchema.safeParse(listingId).success) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
    const row = await serial(this.db, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${listingId}::uuid FOR UPDATE`;
      const listing = await tx.listing.findUnique({ where: { id: listingId }, include: { currentRevision: true } });
      if (!listing || !listing.currentRevision) throw new AppException(404, 'NOT_FOUND', 'Listing tidak ditemukan.');
      const ownerId = listing.ownerId;
      if (ownerId === userId) throw new AppException(400, 'INVALID_INPUT', 'Percakapan hanya tersedia dengan pihak lain.');
      const [participantAId, participantBId] = [userId, ownerId].sort();
      const existing = await tx.conversation.findUnique({ where: { listingId_participantAId_participantBId: { listingId, participantAId, participantBId } }, include: { participantA: true, participantB: true, listing: { include: { currentRevision: true } }, messages: { where: { deletedAt: null }, orderBy: { sequence: 'desc' }, take: 1 } } });
      if (existing) return existing;
      if (listing.status !== 'ACTIVE') throw new AppException(409, 'STATE_CONFLICT', 'Listing tidak menerima percakapan baru.');
      if (await this.hasActiveBlock(tx, userId, ownerId)) throw new AppException(403, 'FORBIDDEN', 'Interaksi dengan akun ini dibatasi.');
      return tx.conversation.create({ data: { listingId, participantAId, participantBId }, include: { participantA: true, participantB: true, listing: { include: { currentRevision: true } }, messages: true } });
    });
    return this.toDto(row, userId);
  }

  async list(userId: string): Promise<ConversationDto[]> {
    const rows = await this.db.conversation.findMany({ where: { OR: [{ participantAId: userId }, { participantBId: userId }] }, include: { participantA: true, participantB: true, listing: { include: { currentRevision: true } }, messages: { where: { deletedAt: null }, orderBy: { sequence: 'desc' }, take: 1 } }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 100 });
    return Promise.all(rows.map((row) => this.toDto(row, userId)));
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const conversations = await this.db.conversation.findMany({ where: { OR: [{ participantAId: userId }, { participantBId: userId }] }, select: { id: true, participantAId: true, readSequenceA: true, readSequenceB: true } });
    const counts = await Promise.all(conversations.map((row) => this.db.message.count({ where: { conversationId: row.id, senderId: { not: userId }, sequence: { gt: row.participantAId === userId ? row.readSequenceA : row.readSequenceB }, deletedAt: null } })));
    return { count: counts.reduce((total, count) => total + count, 0) };
  }

  async history(userId: string, id: string, beforeText?: string, limit = 30) {
    await this.conversationRow(userId, id);
    let before: number | undefined;
    if (beforeText) {
      try {
        const parsed = JSON.parse(Buffer.from(beforeText, 'base64url').toString('utf8')) as { sequence: number };
        if (!Number.isSafeInteger(parsed.sequence) || parsed.sequence < 1) throw new Error('invalid');
        before = parsed.sequence;
      } catch { throw new AppException(400, 'INVALID_INPUT', 'Cursor pesan tidak valid.'); }
    }
    const rows = await this.db.message.findMany({ where: { conversationId: id, deletedAt: null, ...(before ? { sequence: { lt: before } } : {}) }, orderBy: { sequence: 'desc' }, take: limit + 1 });
    const page = rows.slice(0, limit).reverse();
    const oldest = page[0];
    return { data: page.map(messageDto), meta: { nextCursor: rows.length > limit && oldest ? cursorEncode(oldest.sequence) : null } };
  }

  async send(userId: string, id: string, input: MessageCreateInput): Promise<MessageDto> {
    const result = await serial(this.db, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Conversation" WHERE id = ${id}::uuid FOR UPDATE`;
      const conversation = await tx.conversation.findUnique({ where: { id } });
      if (!conversation || (conversation.participantAId !== userId && conversation.participantBId !== userId)) throw new AppException(404, 'NOT_FOUND', 'Percakapan tidak ditemukan.');
      const otherUserId = conversation.participantAId === userId ? conversation.participantBId : conversation.participantAId;
      const prior = await tx.message.findUnique({ where: { conversationId_senderId_clientMessageId: { conversationId: id, senderId: userId, clientMessageId: input.clientMessageId } } });
      if (prior) return { row: prior, otherUserId, fresh: false };
      await this.assertCanMessage(userId, otherUserId, id);
      if (await this.hasActiveBlock(tx, userId, otherUserId)) throw new AppException(403, 'FORBIDDEN', 'Pesan baru dibatasi oleh salah satu pihak.');
      const sequence = conversation.messageSequence + 1;
      const row = await tx.message.create({ data: { conversationId: id, senderId: userId, body: input.body, clientMessageId: input.clientMessageId, sequence } });
      const isA = conversation.participantAId === userId;
      await tx.conversation.update({ where: { id }, data: { messageSequence: sequence, ...(isA ? { readSequenceA: sequence } : { readSequenceB: sequence }) } });
      return { row, otherUserId, fresh: true };
    });
    if (result.fresh) {
      this.events.publish({ userId, conversationId: id, sequence: result.row.sequence });
      this.events.publish({ userId: result.otherUserId, conversationId: id, sequence: result.row.sequence });
    }
    return messageDto(result.row);
  }

  async markRead(userId: string, id: string): Promise<{ unreadCount: number }> {
    const updated = await serial(this.db, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Conversation" WHERE id = ${id}::uuid FOR UPDATE`;
      const row = await tx.conversation.findUnique({ where: { id } });
      if (!row || (row.participantAId !== userId && row.participantBId !== userId)) throw new AppException(404, 'NOT_FOUND', 'Percakapan tidak ditemukan.');
      return tx.conversation.update({ where: { id }, data: row.participantAId === userId ? { readSequenceA: row.messageSequence } : { readSequenceB: row.messageSequence } });
    });
    const readSequence = updated.participantAId === userId ? updated.readSequenceA : updated.readSequenceB;
    const unreadCount = await this.db.message.count({ where: { conversationId: id, senderId: { not: userId }, sequence: { gt: readSequence }, deletedAt: null } });
    return { unreadCount };
  }

  stream(userId: string, sessionId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let stopped = false;
      const validate = async (event?: MessageEvent) => {
        try {
          const session = await this.db.session.findFirst({ where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: new Date() }, user: { status: 'ACTIVE' } } });
          if (!session) { subscriber.complete(); return; }
          if (!stopped && event) subscriber.next(event);
        } catch { subscriber.complete(); }
      };
      const source = this.events.forUser(userId).subscribe((event) => { void validate(event); });
      const timer = setInterval(() => { void validate(); }, 10000); void validate();
      return () => { stopped = true; source.unsubscribe(); clearInterval(timer); };
    });
  }
}
