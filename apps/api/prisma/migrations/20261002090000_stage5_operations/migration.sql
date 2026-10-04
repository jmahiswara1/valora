-- AlterEnum
ALTER TYPE "ReportTargetType" ADD VALUE 'TRANSACTION';

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "valid" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "IdempotencyRequest" ADD COLUMN     "purgedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ImpactEvent" ADD COLUMN     "correctionOfId" UUID,
ADD COLUMN     "reason" VARCHAR(1000);

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "passportVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "passportVisibility" VARCHAR(20) NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "PassportEvent" ADD COLUMN     "correctionOfId" UUID;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "retentionHoldUntil" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "correctedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CorrectionCase" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "openedById" UUID NOT NULL,
    "assignedAdminId" UUID,
    "reason" VARCHAR(1000) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "resolution" VARCHAR(40),
    "resolutionReason" VARCHAR(1000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CorrectionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionEvidence" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "submittedById" UUID NOT NULL,
    "note" VARCHAR(3000) NOT NULL,
    "messageId" UUID,
    "messageSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "CorrectionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationsAccessGrant" (
    "id" UUID NOT NULL,
    "scopeType" VARCHAR(20) NOT NULL,
    "scopeId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationsAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionHold" (
    "id" UUID NOT NULL,
    "scopeType" VARCHAR(20) NOT NULL,
    "scopeId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "reviewAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetentionHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageDeletion" (
    "id" UUID NOT NULL,
    "storageKey" VARCHAR(180) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastError" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRun" (
    "id" UUID NOT NULL,
    "job" VARCHAR(60) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    "counts" JSONB,
    "error" VARCHAR(200),

    CONSTRAINT "MaintenanceRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricDraft" (
    "id" UUID NOT NULL,
    "rubricKey" VARCHAR(120) NOT NULL,
    "baseVersionId" UUID NOT NULL,
    "questionConfig" JSONB NOT NULL,
    "safetyConfig" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "publishedVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RubricDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomicReference" (
    "id" UUID NOT NULL,
    "categoryCode" VARCHAR(50) NOT NULL,
    "field" VARCHAR(40) NOT NULL,
    "amountIdr" BIGINT NOT NULL,
    "sourceNote" VARCHAR(500) NOT NULL,
    "referenceDate" DATE NOT NULL,
    "region" VARCHAR(120) NOT NULL,
    "createdById" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EconomicReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExplanationCache" (
    "key" VARCHAR(250) NOT NULL,
    "assessmentId" UUID NOT NULL,
    "templateVersion" VARCHAR(30) NOT NULL,
    "output" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExplanationCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "CorrectionCase_transactionId_status_idx" ON "CorrectionCase"("transactionId", "status");

-- CreateIndex
CREATE INDEX "OperationsAccessGrant_scopeType_scopeId_adminId_expiresAt_idx" ON "OperationsAccessGrant"("scopeType", "scopeId", "adminId", "expiresAt");

-- CreateIndex
CREATE INDEX "RetentionHold_scopeType_scopeId_reviewAt_idx" ON "RetentionHold"("scopeType", "scopeId", "reviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "StorageDeletion_storageKey_key" ON "StorageDeletion"("storageKey");

-- AddForeignKey
ALTER TABLE "CorrectionEvidence" ADD CONSTRAINT "CorrectionEvidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CorrectionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
