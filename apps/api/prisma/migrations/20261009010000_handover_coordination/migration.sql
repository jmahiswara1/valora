-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "agreedHandoverId" UUID;

-- CreateTable
CREATE TABLE "HandoverProposal" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "proposedById" UUID NOT NULL,
    "method" VARCHAR(20) NOT NULL,
    "plannedAt" TIMESTAMP(3) NOT NULL,
    "timeZone" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "endReason" VARCHAR(60),
    "privateDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "respondedById" UUID,
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "HandoverProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentRecord" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "courier" VARCHAR(100),
    "trackingNumber" VARCHAR(100),
    "reason" VARCHAR(1000),
    "revision" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "ShipmentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverEvent" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "actorId" UUID,
    "type" VARCHAR(50) NOT NULL,
    "proposalId" UUID,
    "itemId" UUID,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandoverEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HandoverProposal_transactionId_createdAt_id_idx" ON "HandoverProposal"("transactionId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "HandoverProposal_status_plannedAt_idx" ON "HandoverProposal"("status", "plannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentRecord_proposalId_itemId_revision_key" ON "ShipmentRecord"("proposalId", "itemId", "revision");

-- CreateIndex
CREATE INDEX "HandoverEvent_transactionId_occurredAt_id_idx" ON "HandoverEvent"("transactionId", "occurredAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_agreedHandoverId_key" ON "Transaction"("agreedHandoverId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_agreedHandoverId_fkey" FOREIGN KEY ("agreedHandoverId") REFERENCES "HandoverProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverProposal" ADD CONSTRAINT "HandoverProposal_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentRecord" ADD CONSTRAINT "ShipmentRecord_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "HandoverProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverEvent" ADD CONSTRAINT "HandoverEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "HandoverProposal_one_pending" ON "HandoverProposal" ("transactionId") WHERE "status" = 'PENDING';
