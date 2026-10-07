import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import type { MessagePhotoScope, MediaTicketInput } from '@valora/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { StorageService } from '../../infrastructure/storage.service.js';
import { secret } from '../../infrastructure/config.js';
import { MediaService } from '../media/service.js';
import { OperationsService } from '../operations/service.js';
import { assignedScope } from '../operations/helpers.js';
import { AppException } from '../../shared/http.js';
import { serial, validId } from '../../shared/transactions.js';

@Injectable()
export class MessagePhotosService {
  private readonly key = secret('MEDIA_SIGNING_KEY');
  constructor(private readonly db: DatabaseService, private readonly media: MediaService, private readonly storage: StorageService, private readonly operations: OperationsService) {}

  async ticket(userId: string, conversationId: string, input: MediaTicketInput) {
    validId(conversationId);
    return this.media.ticket(userId, { ...input, purpose: 'MESSAGE_ATTACHMENT' }, undefined, undefined, undefined, conversationId);
  }

  private async authorized(tx: Prisma.TransactionClient, userId: string, id: string, scope: MessagePhotoScope) {
    const row = await tx.messageAttachment.findFirst({ where: { id, deletedAt: null, message: { deletedAt: null } }, include: { message: { include: { conversation: true } } } });
    if (!row) throw new AppException(404, 'NOT_FOUND', 'Foto pesan tidak ditemukan.');
    const conversation = row.message.conversation;
    if ([conversation.participantAId, conversation.participantBId].includes(userId)) return row;
    if (!scope.scopeType || !scope.scopeId || !await tx.user.findFirst({ where: { id: userId, status: 'ACTIVE', role: 'ADMIN' } })) throw new AppException(404, 'NOT_FOUND', 'Foto pesan tidak ditemukan.');
    if (scope.scopeType === 'DISPUTE') {
      const record = await tx.disputeCase.findUnique({ where: { id: scope.scopeId }, include: { transaction: true } });
      const grant = await tx.caseAccessGrant.findFirst({ where: { caseId: scope.scopeId, adminId: userId, kind: 'CHAT', expiresAt: { gt: new Date() } } });
      if (record && grant && conversation.listingId === record.transaction.listingId && [conversation.participantAId, conversation.participantBId].every(id => [record.transaction.sellerOrDonorId, record.transaction.buyerOrRecipientId].includes(id))) {
        await assignedScope(tx, userId, 'DISPUTE', scope.scopeId, true);
        return row;
      }
    }
    await this.operations.requireGrant(tx, userId, scope.scopeType, scope.scopeId);
    const matches = scope.scopeType === 'REPORT'
      ? Boolean(await tx.report.findFirst({ where: { id: scope.scopeId, messageId: row.messageId, targetType: 'MESSAGE' } }))
      : scope.scopeType === 'DISPUTE'
        ? Boolean(await tx.caseEvidence.findFirst({ where: { caseId: scope.scopeId, messageId: row.messageId } }))
        : Boolean(await tx.correctionEvidence.findFirst({ where: { caseId: scope.scopeId, messageId: row.messageId } }));
    if (!matches) throw new AppException(404, 'NOT_FOUND', 'Foto bukan bukti pada kasus ini.');
    return row;
  }

  private sign(userId: string, sessionId: string, id: string, expires: number, scope: MessagePhotoScope) {
    return createHmac('sha256', this.key).update(JSON.stringify(['message-photo', userId, sessionId, id, expires, scope.scopeType ?? '', scope.scopeId ?? ''])).digest('hex');
  }

  async access(userId: string, sessionId: string, id: string, scope: MessagePhotoScope) {
    validId(id);
    await serial(this.db, tx => this.authorized(tx, userId, id, scope));
    const expires = Date.now() + 300_000;
    const query = new URLSearchParams({ expires: String(expires), signature: this.sign(userId, sessionId, id, expires, scope), ...(scope.scopeType && scope.scopeId ? { scopeType: scope.scopeType, scopeId: scope.scopeId } : {}) });
    return { url: `/api/v1/message-photos/private/${id}?${query}`, expiresAt: new Date(expires).toISOString() };
  }

  async privatePhoto(userId: string, sessionId: string, id: string, expiresText: string, signature: string, scope: MessagePhotoScope, res: Response) {
    validId(id);
    const expires = Number(expiresText);
    if (!Number.isSafeInteger(expires) || expires <= Date.now() || expires > Date.now() + 300_000 || !/^[a-f0-9]{64}$/.test(signature ?? '') || !timingSafeEqual(Buffer.from(this.sign(userId, sessionId, id, expires, scope), 'hex'), Buffer.from(signature, 'hex'))) throw new AppException(403, 'FORBIDDEN', 'Tautan foto sudah tidak berlaku.');
    const bytes = await serial(this.db, async tx => {
      const row = await this.authorized(tx, userId, id, scope);
      return this.storage.read(row.storageKey);
    });
    res.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.send(bytes);
  }
}
