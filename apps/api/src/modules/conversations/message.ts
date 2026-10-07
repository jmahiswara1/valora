import type { MessageDto, MessageAttachmentDto } from '@valora/contracts';

export const attachmentDto = (row: MessageAttachmentDto): MessageAttachmentDto => ({ id: row.id, mime: row.mime, bytes: row.bytes, width: row.width, height: row.height, orderIndex: row.orderIndex });
export const messageDto = (row: { id: string; conversationId: string; senderId: string; body: string; clientMessageId: string; sequence: number; sentAt: Date; attachments: MessageAttachmentDto[] }): MessageDto => ({
  id: row.id, conversationId: row.conversationId, senderId: row.senderId, body: row.body, clientMessageId: row.clientMessageId,
  sequence: row.sequence, attachments: row.attachments.map(attachmentDto), sentAt: row.sentAt.toISOString(),
});
