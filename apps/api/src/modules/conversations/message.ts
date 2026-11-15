import type { MessageDto, MessageAttachmentDto } from '@valora/contracts';
import type { Prisma } from '../../generated/prisma/client.js';

export const messageRelations = {
  attachments: { where: { deletedAt: null }, orderBy: { orderIndex: 'asc' } },
  handoverProposal: { select: { id: true, transactionId: true } },
} satisfies Prisma.MessageInclude;

export const attachmentDto = (row: MessageAttachmentDto): MessageAttachmentDto => ({ id: row.id, mime: row.mime, bytes: row.bytes, width: row.width, height: row.height, orderIndex: row.orderIndex });
export const messageDto = (row: { id: string; conversationId: string; senderId: string; body: string; clientMessageId: string; sequence: number; sentAt: Date; attachments: MessageAttachmentDto[]; handoverProposal?: { id: string; transactionId: string } | null }): MessageDto => ({
  id: row.id, conversationId: row.conversationId, senderId: row.senderId, body: row.body, clientMessageId: row.clientMessageId,
  sequence: row.sequence, attachments: row.attachments.map(attachmentDto), sentAt: row.sentAt.toISOString(),
  ...(row.handoverProposal ? { handover: { transactionId: row.handoverProposal.transactionId, proposalId: row.handoverProposal.id } } : {}),
});
