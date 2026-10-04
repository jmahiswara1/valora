-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('RESELL', 'EXCHANGE', 'DONATE');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'RESERVED', 'CLOSED', 'REJECTED', 'WITHDRAWN', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ModerationDecision" AS ENUM ('APPROVE', 'REQUEST_CHANGES', 'REJECT');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('LISTING', 'MESSAGE', 'USER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Listing" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "type" "ListingType" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "currentRevisionId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingRevision" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "itemRevision" INTEGER NOT NULL,
    "rubricVersionId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "categoryCode" VARCHAR(50) NOT NULL,
    "subcategoryCode" VARCHAR(50),
    "cityId" UUID NOT NULL,
    "condition" INTEGER NOT NULL,
    "score" INTEGER,
    "scoreLabel" VARCHAR(40),
    "ruleVersion" VARCHAR(30) NOT NULL,
    "policyVersion" VARCHAR(30) NOT NULL,
    "assessmentSnapshot" JSONB NOT NULL,
    "conditionDisclosure" VARCHAR(1500) NOT NULL,
    "askingPriceIdr" BIGINT,
    "exchangePreference" VARCHAR(1000),
    "recipientNote" VARCHAR(500),
    "handoverMethods" TEXT[],
    "copyOnlyCorrection" BOOLEAN NOT NULL DEFAULT false,
    "riskFlags" TEXT[],
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingRevisionMedia" (
    "revisionId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "ListingRevisionMedia_pkey" PRIMARY KEY ("revisionId","mediaId")
);

-- CreateTable
CREATE TABLE "ModerationReview" (
    "id" UUID NOT NULL,
    "listingRevisionId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "decision" "ModerationDecision" NOT NULL,
    "reasonCode" VARCHAR(60) NOT NULL,
    "reasonText" VARCHAR(1000) NOT NULL,
    "riskFlags" TEXT[],
    "rubricVersionId" UUID NOT NULL,
    "policyVersion" VARCHAR(30) NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "listingRevisionId" UUID NOT NULL,
    "bidderId" UUID NOT NULL,
    "exchangeItemId" UUID,
    "clientRequestId" UUID NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "endReason" VARCHAR(60),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "currentRevisionNo" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferRevision" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "priceIdr" BIGINT,
    "message" VARCHAR(500),
    "proposedById" UUID NOT NULL,
    "respondsById" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "participantAId" UUID NOT NULL,
    "participantBId" UUID NOT NULL,
    "messageSequence" INTEGER NOT NULL DEFAULT 0,
    "readSequenceA" INTEGER NOT NULL DEFAULT 0,
    "readSequenceB" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "clientMessageId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" UUID NOT NULL,
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "messageId" UUID,
    "reasonCode" VARCHAR(60) NOT NULL,
    "details" VARCHAR(1000) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "assignedAdminId" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "reportId" UUID,
    "targetType" VARCHAR(40) NOT NULL,
    "targetId" UUID NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_currentRevisionId_key" ON "Listing"("currentRevisionId");

-- CreateIndex
CREATE INDEX "Listing_status_updatedAt_id_idx" ON "Listing"("status", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "Listing_ownerId_status_updatedAt_idx" ON "Listing"("ownerId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ListingRevision_itemId_itemRevision_idx" ON "ListingRevision"("itemId", "itemRevision");

-- CreateIndex
CREATE INDEX "ListingRevision_assessmentId_idx" ON "ListingRevision"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingRevision_listingId_revisionNo_key" ON "ListingRevision"("listingId", "revisionNo");

-- CreateIndex
CREATE INDEX "ListingRevisionMedia_mediaId_idx" ON "ListingRevisionMedia"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingRevisionMedia_revisionId_orderIndex_key" ON "ListingRevisionMedia"("revisionId", "orderIndex");

-- CreateIndex
CREATE INDEX "ModerationReview_decision_createdAt_idx" ON "ModerationReview"("decision", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationReview_listingRevisionId_key" ON "ModerationReview"("listingRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationReview_reviewerId_idempotencyKey_key" ON "ModerationReview"("reviewerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_clientRequestId_key" ON "Offer"("clientRequestId");

-- CreateIndex
CREATE INDEX "Offer_listingId_status_expiresAt_idx" ON "Offer"("listingId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "Offer_bidderId_status_updatedAt_idx" ON "Offer"("bidderId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "OfferRevision_respondsById_expiresAt_idx" ON "OfferRevision"("respondsById", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfferRevision_offerId_revisionNo_key" ON "OfferRevision"("offerId", "revisionNo");

-- CreateIndex
CREATE INDEX "Conversation_participantAId_updatedAt_idx" ON "Conversation"("participantAId", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_participantBId_updatedAt_idx" ON "Conversation"("participantBId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_listingId_participantAId_participantBId_key" ON "Conversation"("listingId", "participantAId", "participantBId");

-- CreateIndex
CREATE INDEX "Message_conversationId_sentAt_id_idx" ON "Message"("conversationId", "sentAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_senderId_clientMessageId_key" ON "Message"("conversationId", "senderId", "clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_sequence_key" ON "Message"("conversationId", "sequence");

-- CreateIndex
CREATE INDEX "UserBlock_blockedId_revokedAt_idx" ON "UserBlock"("blockedId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminAction_targetType_targetId_createdAt_idx" ON "AdminAction"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAction_reportId_createdAt_idx" ON "AdminAction"("reportId", "createdAt");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "ListingRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingRevision" ADD CONSTRAINT "ListingRevision_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingRevision" ADD CONSTRAINT "ListingRevision_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingRevision" ADD CONSTRAINT "ListingRevision_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingRevision" ADD CONSTRAINT "ListingRevision_categoryCode_fkey" FOREIGN KEY ("categoryCode") REFERENCES "Category"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingRevision" ADD CONSTRAINT "ListingRevision_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingRevisionMedia" ADD CONSTRAINT "ListingRevisionMedia_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ListingRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingRevisionMedia" ADD CONSTRAINT "ListingRevisionMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReview" ADD CONSTRAINT "ModerationReview_listingRevisionId_fkey" FOREIGN KEY ("listingRevisionId") REFERENCES "ListingRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReview" ADD CONSTRAINT "ModerationReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_listingRevisionId_fkey" FOREIGN KEY ("listingRevisionId") REFERENCES "ListingRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_exchangeItemId_fkey" FOREIGN KEY ("exchangeItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferRevision" ADD CONSTRAINT "OfferRevision_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferRevision" ADD CONSTRAINT "OfferRevision_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferRevision" ADD CONSTRAINT "OfferRevision_respondsById_fkey" FOREIGN KEY ("respondsById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_participantAId_fkey" FOREIGN KEY ("participantAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_participantBId_fkey" FOREIGN KEY ("participantBId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
