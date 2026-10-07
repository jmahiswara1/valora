ALTER TABLE "Listing" ADD COLUMN "firstPublishedAt" TIMESTAMP(3);
UPDATE "Listing" l SET "firstPublishedAt" = COALESCE(
  (SELECT MIN(m."createdAt") FROM "ModerationReview" m JOIN "ListingRevision" r ON r.id = m."listingRevisionId" WHERE r."listingId" = l.id AND m.decision = 'APPROVE'), l."publishedAt"
);
CREATE TABLE "SavedSearch" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "name" VARCHAR(80) NOT NULL, "filters" JSONB NOT NULL,
  "fingerprint" CHAR(64) NOT NULL, "sort" VARCHAR(20) NOT NULL DEFAULT 'newest',
  "alertsEnabled" BOOLEAN NOT NULL DEFAULT true, "alertsSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "alertsAfterPublication" INTEGER NOT NULL DEFAULT 0, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SavedSearch_userId_fingerprint_key" ON "SavedSearch"("userId", "fingerprint");
CREATE INDEX "SavedSearch_userId_createdAt_id_idx" ON "SavedSearch"("userId", "createdAt", "id");
CREATE INDEX "SavedSearch_alertsEnabled_alertsAfterPublication_id_idx" ON "SavedSearch"("alertsEnabled", "alertsAfterPublication", "id");
CREATE TABLE "SearchPublication" (
  "listingId" UUID NOT NULL, "sequence" SERIAL NOT NULL, "revisionId" UUID NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL, "afterSearchId" UUID, "processedAt" TIMESTAMP(3),
  CONSTRAINT "SearchPublication_pkey" PRIMARY KEY ("listingId"),
  CONSTRAINT "SearchPublication_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SearchPublication_sequence_key" ON "SearchPublication"("sequence");
CREATE INDEX "SearchPublication_processedAt_sequence_idx" ON "SearchPublication"("processedAt", "sequence");
