ALTER TABLE "RepairCorrection"
  ADD COLUMN "idempotencyKey" UUID,
  ADD COLUMN "payloadHash" CHAR(64),
  ADD COLUMN "responseSnapshot" JSONB;

CREATE UNIQUE INDEX "RepairCorrection_createdById_idempotencyKey_key"
  ON "RepairCorrection"("createdById", "idempotencyKey");
