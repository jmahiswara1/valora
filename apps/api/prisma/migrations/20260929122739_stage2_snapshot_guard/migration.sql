-- DropForeignKey
ALTER TABLE "MediaAsset" DROP CONSTRAINT "MediaAsset_repairRecordId_fkey";

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "repairabilityReason" VARCHAR(30);

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_repairRecordId_fkey" FOREIGN KEY ("repairRecordId") REFERENCES "RepairRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
