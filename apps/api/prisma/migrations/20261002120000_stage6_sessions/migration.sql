ALTER TABLE "Session" ADD COLUMN "reauthenticatedAt" TIMESTAMP(3);
UPDATE "Session" SET "reauthenticatedAt" = "createdAt";
ALTER TABLE "Session" ALTER COLUMN "reauthenticatedAt" SET NOT NULL, ALTER COLUMN "reauthenticatedAt" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TABLE "AuthRateBucket" ("key" CHAR(64) PRIMARY KEY, "count" INTEGER NOT NULL DEFAULT 1, "resetAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "AuthRateBucket_resetAt_idx" ON "AuthRateBucket" ("resetAt");
ALTER TABLE "StorageDeletion" ADD COLUMN "kind" VARCHAR(16) NOT NULL DEFAULT 'MEDIA';
