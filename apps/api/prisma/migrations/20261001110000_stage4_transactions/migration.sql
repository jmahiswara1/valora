-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED', 'DISPUTED', 'CANCELLED', 'COMPLETED');

-- AlterEnum
ALTER TYPE "UploadPurpose" ADD VALUE 'CASE_EVIDENCE';

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "caseId" UUID,
ADD COLUMN     "evidenceId" UUID;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "exchangeSnapshot" JSONB;

-- AlterTable
ALTER TABLE "UploadTicket" ADD COLUMN     "caseId" UUID;

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "offeredItemId" UUID,
    "sellerOrDonorId" UUID NOT NULL,
    "buyerOrRecipientId" UUID NOT NULL,
    "type" "ListingType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'AWAITING_HANDOVER',
    "snapshot" JSONB NOT NULL,
    "privateSnapshot" JSONB NOT NULL,
    "finalPriceIdr" BIGINT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetHandoverAt" TIMESTAMP(3) NOT NULL,
    "overdueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "resolutionOrigin" VARCHAR(30),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverConfirmation" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" VARCHAR(30) NOT NULL DEFAULT 'USER_CONFIRMED',
    "idempotencyKey" UUID NOT NULL,

    CONSTRAINT "HandoverConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationRequest" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "respondedById" UUID,
    "respondedAt" TIMESTAMP(3),
    "endReason" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeCase" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "openedById" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "assignedAdminId" UUID,
    "resolution" VARCHAR(30),
    "resolutionReason" VARCHAR(1000),
    "resolvedAt" TIMESTAMP(3),
    "retentionHoldUntil" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseEvidence" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "submittedById" UUID NOT NULL,
    "note" VARCHAR(3000),
    "messageId" UUID,
    "messageSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseAccessGrant" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipTransfer" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "fromUserId" UUID NOT NULL,
    "toUserId" UUID NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origin" VARCHAR(30) NOT NULL,

    CONSTRAINT "OwnershipTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportEvent" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "eventKey" VARCHAR(250) NOT NULL,
    "eventType" VARCHAR(40) NOT NULL,
    "sourceType" VARCHAR(40) NOT NULL,
    "sourceId" UUID NOT NULL,
    "origin" VARCHAR(30) NOT NULL,
    "publicPayload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassportEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactEvent" (
    "id" UUID NOT NULL,
    "eventKey" VARCHAR(250) NOT NULL,
    "metric" VARCHAR(40) NOT NULL,
    "sourceType" VARCHAR(40) NOT NULL,
    "sourceId" UUID NOT NULL,
    "itemId" UUID,
    "attributedUserId" UUID,
    "delta" BIGINT NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRequest" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "key" UUID NOT NULL,
    "operation" VARCHAR(180) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "responseBody" JSONB NOT NULL,
    "responseCode" INTEGER NOT NULL DEFAULT 201,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eventKey" VARCHAR(200) NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_offerId_key" ON "Transaction"("offerId");

-- CreateIndex
CREATE INDEX "Transaction_sellerOrDonorId_acceptedAt_id_idx" ON "Transaction"("sellerOrDonorId", "acceptedAt", "id");

-- CreateIndex
CREATE INDEX "Transaction_buyerOrRecipientId_acceptedAt_id_idx" ON "Transaction"("buyerOrRecipientId", "acceptedAt", "id");

-- CreateIndex
CREATE INDEX "Transaction_status_targetHandoverAt_idx" ON "Transaction"("status", "targetHandoverAt");

-- CreateIndex
CREATE UNIQUE INDEX "HandoverConfirmation_transactionId_actorId_itemId_kind_key" ON "HandoverConfirmation"("transactionId", "actorId", "itemId", "kind");

-- CreateIndex
CREATE INDEX "DisputeCase_status_createdAt_id_idx" ON "DisputeCase"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "CaseAccessGrant_caseId_adminId_kind_expiresAt_idx" ON "CaseAccessGrant"("caseId", "adminId", "kind", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OwnershipTransfer_transactionId_itemId_key" ON "OwnershipTransfer"("transactionId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PassportEvent_eventKey_key" ON "PassportEvent"("eventKey");

-- CreateIndex
CREATE INDEX "PassportEvent_itemId_occurredAt_id_idx" ON "PassportEvent"("itemId", "occurredAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactEvent_eventKey_key" ON "ImpactEvent"("eventKey");

-- CreateIndex
CREATE INDEX "ImpactEvent_metric_attributedUserId_occurredAt_idx" ON "ImpactEvent"("metric", "attributedUserId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRequest_actorId_key_operation_key" ON "IdempotencyRequest"("actorId", "key", "operation");

-- CreateIndex
CREATE UNIQUE INDEX "InAppNotification_eventKey_key" ON "InAppNotification"("eventKey");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_createdAt_id_idx" ON "InAppNotification"("userId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_reservedByTransactionId_fkey" FOREIGN KEY ("reservedByTransactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadTicket" ADD CONSTRAINT "UploadTicket_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "CaseEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_offeredItemId_fkey" FOREIGN KEY ("offeredItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sellerOrDonorId_fkey" FOREIGN KEY ("sellerOrDonorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_buyerOrRecipientId_fkey" FOREIGN KEY ("buyerOrRecipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverConfirmation" ADD CONSTRAINT "HandoverConfirmation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAccessGrant" ADD CONSTRAINT "CaseAccessGrant_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportEvent" ADD CONSTRAINT "PassportEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Serialize active selections and preserve historical Exchange offers without guessing their snapshots.
CREATE UNIQUE INDEX "CancellationRequest_one_pending_idx" ON "CancellationRequest" ("transactionId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "DisputeCase_one_active_idx" ON "DisputeCase" ("transactionId") WHERE "status" IN ('OPEN', 'IN_REVIEW');
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_type_shape_check" CHECK (
  ("type" = 'RESELL' AND "finalPriceIdr" > 0 AND "offeredItemId" IS NULL) OR
  ("type" = 'EXCHANGE' AND "finalPriceIdr" IS NULL AND "offeredItemId" IS NOT NULL AND "offeredItemId" <> "itemId") OR
  ("type" = 'DONATE' AND "finalPriceIdr" IS NULL AND "offeredItemId" IS NULL)
);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_distinct_parties_check" CHECK ("sellerOrDonorId" <> "buyerOrRecipientId");
ALTER TABLE "HandoverConfirmation" ADD CONSTRAINT "HandoverConfirmation_kind_check" CHECK ("kind" IN ('HANDED_OVER', 'RECEIVED'));
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_status_check" CHECK ("status" IN ('PENDING', 'ACCEPTED', 'REJECTED'));
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_status_check" CHECK ("status" IN ('OPEN', 'IN_REVIEW', 'RESOLVED'));
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_evidence_shape_check" CHECK (("caseId" IS NULL AND "evidenceId" IS NULL) OR ("caseId" IS NOT NULL AND "evidenceId" IS NOT NULL AND "repairRecordId" IS NULL AND "shareWithFutureOwner" = false));
UPDATE "Offer" SET "status" = 'EXPIRED', "endReason" = 'EXCHANGE_SNAPSHOT_REQUIRED', "version" = "version" + 1 WHERE "exchangeItemId" IS NOT NULL AND "exchangeSnapshot" IS NULL AND "status" IN ('PENDING', 'COUNTERED');
