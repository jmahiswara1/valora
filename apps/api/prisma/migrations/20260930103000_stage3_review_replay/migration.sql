DROP INDEX IF EXISTS "ModerationReview_listingRevisionId_key";

CREATE INDEX "ModerationReview_listingRevisionId_createdAt_idx"
  ON "ModerationReview" ("listingRevisionId", "createdAt");
