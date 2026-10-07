-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportTargetType" ADD VALUE 'REVIEW';
ALTER TYPE "ReportTargetType" ADD VALUE 'REVIEW_REPLY';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profilePhotoPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(1000),
    "visibility" VARCHAR(10) NOT NULL DEFAULT 'VISIBLE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewReply" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" VARCHAR(1000),
    "visibility" VARCHAR(10) NOT NULL DEFAULT 'VISIBLE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_subjectId_visibility_createdAt_id_idx" ON "Review"("subjectId", "visibility", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Review_transactionId_authorId_key" ON "Review"("transactionId", "authorId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReply_reviewId_key" ON "ReviewReply"("reviewId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Review" ADD CONSTRAINT "Review_distinct_parties_check" CHECK ("authorId" <> "subjectId");
ALTER TABLE "Review" ADD CONSTRAINT "Review_visibility_check" CHECK ("visibility" IN ('VISIBLE', 'HIDDEN'));
ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_visibility_check" CHECK ("visibility" IN ('VISIBLE', 'HIDDEN'));
