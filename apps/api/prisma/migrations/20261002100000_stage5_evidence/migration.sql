-- AlterTable
ALTER TABLE "UploadTicket" ADD COLUMN     "correctionCaseId" UUID;

-- CreateTable
CREATE TABLE "CorrectionAttachment" (
    "id" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "storageKey" VARCHAR(180) NOT NULL,
    "mime" VARCHAR(40) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectionAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CorrectionAttachment_storageKey_key" ON "CorrectionAttachment"("storageKey");

-- AddForeignKey
ALTER TABLE "UploadTicket" ADD CONSTRAINT "UploadTicket_correctionCaseId_fkey" FOREIGN KEY ("correctionCaseId") REFERENCES "CorrectionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionAttachment" ADD CONSTRAINT "CorrectionAttachment_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "CorrectionEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CorrectionCase" ADD CONSTRAINT "CorrectionCase_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT;
ALTER TABLE "CorrectionCase" ADD CONSTRAINT "CorrectionCase_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "CorrectionCase" ADD CONSTRAINT "CorrectionCase_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "PassportEvent" ADD CONSTRAINT "PassportEvent_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "PassportEvent"("id") ON DELETE RESTRICT;
ALTER TABLE "ImpactEvent" ADD CONSTRAINT "ImpactEvent_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "ImpactEvent"("id") ON DELETE RESTRICT;
ALTER TABLE "CorrectionCase" ADD CONSTRAINT "CorrectionCase_status_check" CHECK ("status" IN ('OPEN','IN_REVIEW','RESOLVED','BLOCKED'));
ALTER TABLE "Item" ADD CONSTRAINT "Item_passport_visibility_check" CHECK ("passportVisibility" IN ('PUBLIC','LIMITED','HIDDEN'));
CREATE UNIQUE INDEX "CorrectionCase_active_transaction_key" ON "CorrectionCase"("transactionId") WHERE "status" IN ('OPEN','IN_REVIEW');
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_type_shape_check";
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_type_shape_check" CHECK (
  ("type" = 'RESELL' AND "offeredItemId" IS NULL AND "finalPriceIdr" IS NOT NULL AND "finalPriceIdr" > 0)
  OR ("type" = 'DONATE' AND "offeredItemId" IS NULL AND "finalPriceIdr" IS NULL)
  OR ("type" = 'EXCHANGE' AND "offeredItemId" IS NOT NULL AND "offeredItemId" <> "itemId" AND "finalPriceIdr" IS NULL)
);
CREATE FUNCTION protect_valora_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Valora ledger is append-only'; END;
$$;
CREATE TRIGGER passport_append_only BEFORE UPDATE OR DELETE ON "PassportEvent" FOR EACH ROW EXECUTE FUNCTION protect_valora_ledger();
CREATE TRIGGER impact_append_only BEFORE UPDATE OR DELETE ON "ImpactEvent" FOR EACH ROW EXECUTE FUNCTION protect_valora_ledger();
