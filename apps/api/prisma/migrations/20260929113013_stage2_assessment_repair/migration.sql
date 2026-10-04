-- CreateEnum
CREATE TYPE "UploadPurpose" AS ENUM ('ITEM', 'REPAIR_EVIDENCE');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('INCOMPLETE', 'PARTIAL_ECONOMIC', 'COMPLETE');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('VALID', 'VOID');

-- CreateEnum
CREATE TYPE "RepairOutcome" AS ENUM ('SUCCEEDED', 'UNSUCCESSFUL');

-- CreateEnum
CREATE TYPE "RepairCostKind" AS ENUM ('ACTUAL', 'ESTIMATE');

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "repairRecordId" UUID;

-- AlterTable
ALTER TABLE "UploadTicket" ADD COLUMN     "purpose" "UploadPurpose" NOT NULL DEFAULT 'ITEM';

-- CreateTable
CREATE TABLE "RubricVersion" (
    "id" UUID NOT NULL,
    "rubricKey" VARCHAR(120) NOT NULL,
    "categoryCode" VARCHAR(50) NOT NULL,
    "subcategoryCode" VARCHAR(50),
    "ruleVersion" VARCHAR(30) NOT NULL,
    "policyVersion" VARCHAR(30) NOT NULL,
    "recommendationVersion" VARCHAR(30) NOT NULL,
    "questionConfig" JSONB NOT NULL,
    "safetyConfig" JSONB NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicationReason" VARCHAR(500) NOT NULL,
    "publishedById" UUID,

    CONSTRAINT "RubricVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "itemRevision" INTEGER NOT NULL,
    "rubricVersionId" UUID NOT NULL,
    "status" "AssessmentStatus" NOT NULL,
    "answersSnapshot" JSONB NOT NULL,
    "safetySnapshot" JSONB NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "condition" INTEGER,
    "repairability" INTEGER,
    "economicValue" INTEGER,
    "reusePotential" INTEGER,
    "score" INTEGER,
    "label" VARCHAR(40),
    "missingFields" JSONB NOT NULL,
    "safetyFlags" JSONB NOT NULL,
    "recommendationSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairRecord" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "actionSummary" VARCHAR(1500) NOT NULL,
    "privateNotes" VARCHAR(3000),
    "costIdr" BIGINT,
    "costKind" "RepairCostKind",
    "outcome" "RepairOutcome" NOT NULL,
    "afterCondition" VARCHAR(1500) NOT NULL,
    "status" "RepairStatus" NOT NULL DEFAULT 'VALID',
    "shareSummaryPublic" BOOLEAN NOT NULL DEFAULT false,
    "shareDetailsWithFutureOwner" BOOLEAN NOT NULL DEFAULT false,
    "voidReason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairCorrection" (
    "id" UUID NOT NULL,
    "repairId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "beforeState" JSONB NOT NULL,
    "afterState" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RubricVersion_rubricKey_effectiveAt_idx" ON "RubricVersion"("rubricKey", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "RubricVersion_rubricKey_ruleVersion_policyVersion_key" ON "RubricVersion"("rubricKey", "ruleVersion", "policyVersion");

-- CreateIndex
CREATE INDEX "Assessment_itemId_createdAt_id_idx" ON "Assessment"("itemId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Assessment_createdById_createdAt_idx" ON "Assessment"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "RepairRecord_itemId_performedAt_id_idx" ON "RepairRecord"("itemId", "performedAt", "id");

-- CreateIndex
CREATE INDEX "RepairRecord_createdById_createdAt_idx" ON "RepairRecord"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RepairCorrection_repairId_version_key" ON "RepairCorrection"("repairId", "version");

-- CreateIndex
CREATE INDEX "MediaAsset_repairRecordId_deletedAt_idx" ON "MediaAsset"("repairRecordId", "deletedAt");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_repairRecordId_fkey" FOREIGN KEY ("repairRecordId") REFERENCES "RepairRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricVersion" ADD CONSTRAINT "RubricVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairRecord" ADD CONSTRAINT "RepairRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairRecord" ADD CONSTRAINT "RepairRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairCorrection" ADD CONSTRAINT "RepairCorrection_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "RepairRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairCorrection" ADD CONSTRAINT "RepairCorrection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
