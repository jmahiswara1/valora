-- AlterEnum
ALTER TYPE "UploadPurpose" ADD VALUE 'MESSAGE_ATTACHMENT';

-- AlterTable
ALTER TABLE "UploadTicket" ADD COLUMN     "conversationId" UUID,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "InAppNotification" ADD COLUMN     "conversationId" UUID;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "requestHash" VARCHAR(64);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "sourceTicketId" UUID NOT NULL,
    "storageKey" VARCHAR(180) NOT NULL,
    "mime" VARCHAR(40) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageAttachment_sourceTicketId_key" ON "MessageAttachment"("sourceTicketId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageAttachment_storageKey_key" ON "MessageAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_deletedAt_idx" ON "MessageAttachment"("messageId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageAttachment_messageId_orderIndex_key" ON "MessageAttachment"("messageId", "orderIndex");

-- AddForeignKey
ALTER TABLE "UploadTicket" ADD CONSTRAINT "UploadTicket_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "InAppNotification_unread_conversation_key" ON "InAppNotification" ("userId", "conversationId") WHERE "type" = 'MESSAGE_RECEIVED' AND "readAt" IS NULL;
