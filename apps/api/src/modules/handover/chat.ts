import type { Prisma, Transaction, HandoverProposal } from '../../generated/prisma/client.js';
import type { TransactionSnapshot } from '@valora/contracts';
import { AppException } from '../../shared/http.js';
import { notifyMessage } from '../notifications/events.js';

// A transaction record, rather than free text: only the server can attach this reference.
// Keep addresses and notes in HandoverProposal so private access and retention still apply.
export async function recordProposalMessage(tx: Prisma.TransactionClient, row: Transaction, proposal: HandoverProposal) {
  const [participantAId, participantBId] = [row.sellerOrDonorId, row.buyerOrRecipientId].sort();
  const conversation = await tx.conversation.upsert({
    where: { listingId_participantAId_participantBId: { listingId: row.listingId, participantAId, participantBId } },
    create: { listingId: row.listingId, participantAId, participantBId }, update: {},
  });
  await tx.$queryRaw`SELECT id FROM "Conversation" WHERE id = ${conversation.id}::uuid FOR UPDATE`;
  const current = await tx.conversation.findUniqueOrThrow({ where: { id: conversation.id } });
  if (current.archivedAt) throw new AppException(409, 'STATE_CONFLICT', 'Percakapan transaksi ini telah diarsipkan.');
  const sequence = current.messageSequence + 1;
  const message = await tx.message.create({ data: {
    conversationId: current.id, senderId: proposal.proposedById, clientMessageId: proposal.id,
    body: 'Usulan serah terima baru.', sequence, handoverProposalId: proposal.id,
  } });
  await tx.conversation.update({ where: { id: current.id }, data: { messageSequence: sequence } });
  const peerId = proposal.proposedById === participantAId ? participantBId : participantAId;
  await notifyMessage(tx, peerId, current.id, message.id, sequence, (row.snapshot as unknown as TransactionSnapshot).items[0].title);
}
