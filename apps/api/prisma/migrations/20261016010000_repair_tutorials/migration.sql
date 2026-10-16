-- CreateEnum
CREATE TYPE "RepairActivityKind" AS ENUM ('REPAIR', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "RepairTutorialState" AS ENUM ('PREFLIGHT', 'IN_PROGRESS', 'PAUSED', 'BLOCKED', 'REVIEW', 'RECORDED', 'STOPPED', 'INVALIDATED');

-- AlterEnum
ALTER TYPE "UploadPurpose" ADD VALUE 'REPAIR_TUTORIAL';

-- AlterTable
ALTER TABLE "RepairRecord" ADD COLUMN     "activityKind" "RepairActivityKind" NOT NULL DEFAULT 'REPAIR',
ADD COLUMN     "tutorialSessionId" UUID;

-- AlterTable
ALTER TABLE "UploadTicket" ADD COLUMN     "tutorialSessionId" UUID;

-- CreateTable
CREATE TABLE "RepairTutorialSession" (
    "id" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "guideId" VARCHAR(80) NOT NULL,
    "guideVersion" INTEGER NOT NULL,
    "guideHash" CHAR(64) NOT NULL,
    "guideSnapshot" JSONB NOT NULL,
    "itemContext" JSONB NOT NULL,
    "sourceItemRevision" INTEGER NOT NULL,
    "assessmentId" UUID,
    "problem" VARCHAR(1500) NOT NULL DEFAULT '',
    "preflight" JSONB NOT NULL DEFAULT '{}',
    "progress" JSONB NOT NULL DEFAULT '[]',
    "performedActions" JSONB NOT NULL DEFAULT '[]',
    "draft" JSONB NOT NULL DEFAULT '{}',
    "state" "RepairTutorialState" NOT NULL DEFAULT 'PREFLIGHT',
    "reason" VARCHAR(160),
    "version" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairTutorialSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairTutorialInteraction" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "contextHash" CHAR(64) NOT NULL,
    "stepId" VARCHAR(80) NOT NULL,
    "question" VARCHAR(1000) NOT NULL,
    "photoIds" JSONB NOT NULL DEFAULT '[]',
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "reply" JSONB,
    "model" VARCHAR(160),
    "promptVersion" VARCHAR(80),
    "failureReason" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "RepairTutorialInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairTutorialPhoto" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "storageKey" VARCHAR(180) NOT NULL,
    "stepId" VARCHAR(80) NOT NULL,
    "mime" VARCHAR(40) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairTutorialPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairTutorialAiLease" (
    "key" VARCHAR(80) NOT NULL,
    "token" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "interactionId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairTutorialAiLease_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RepairTutorialSession_createdById_createdAt_id_idx" ON "RepairTutorialSession"("createdById", "createdAt", "id");

-- CreateIndex
CREATE INDEX "RepairTutorialSession_closedAt_purgedAt_idx" ON "RepairTutorialSession"("closedAt", "purgedAt");

-- CreateIndex
CREATE INDEX "RepairTutorialInteraction_sessionId_createdAt_id_idx" ON "RepairTutorialInteraction"("sessionId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RepairTutorialInteraction_createdById_requestId_key" ON "RepairTutorialInteraction"("createdById", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairTutorialPhoto_storageKey_key" ON "RepairTutorialPhoto"("storageKey");

-- CreateIndex
CREATE INDEX "RepairTutorialPhoto_sessionId_deletedAt_idx" ON "RepairTutorialPhoto"("sessionId", "deletedAt");

-- CreateIndex
CREATE INDEX "RepairTutorialAiLease_expiresAt_idx" ON "RepairTutorialAiLease"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RepairRecord_tutorialSessionId_key" ON "RepairRecord"("tutorialSessionId");

-- AddForeignKey
ALTER TABLE "UploadTicket" ADD CONSTRAINT "UploadTicket_tutorialSessionId_fkey" FOREIGN KEY ("tutorialSessionId") REFERENCES "RepairTutorialSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairRecord" ADD CONSTRAINT "RepairRecord_tutorialSessionId_fkey" FOREIGN KEY ("tutorialSessionId") REFERENCES "RepairTutorialSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairTutorialSession" ADD CONSTRAINT "RepairTutorialSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairTutorialSession" ADD CONSTRAINT "RepairTutorialSession_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairTutorialInteraction" ADD CONSTRAINT "RepairTutorialInteraction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RepairTutorialSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairTutorialPhoto" ADD CONSTRAINT "RepairTutorialPhoto_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RepairTutorialSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "RepairTutorialSession_one_unclosed_item" ON "RepairTutorialSession"("itemId") WHERE "closedAt" IS NULL;
