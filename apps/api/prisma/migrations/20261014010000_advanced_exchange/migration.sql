ALTER TABLE "Offer" ADD COLUMN "currentRevisionId" UUID;
ALTER TABLE "OfferRevision" ADD COLUMN "exchangeTerms" JSONB, ADD COLUMN "clientRequestId" UUID, ADD COLUMN "requestHash" CHAR(64);
CREATE UNIQUE INDEX "Offer_currentRevisionId_key" ON "Offer"("currentRevisionId");
CREATE UNIQUE INDEX "OfferRevision_clientRequestId_key" ON "OfferRevision"("clientRequestId");
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "OfferRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "OfferRevisionItem" (
  "revisionId" UUID NOT NULL REFERENCES "OfferRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "itemId" UUID NOT NULL REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY ("revisionId", "itemId")
);
CREATE INDEX "OfferRevisionItem_itemId_idx" ON "OfferRevisionItem"("itemId");
CREATE TABLE "TransactionItem" (
  "transactionId" UUID NOT NULL REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "itemId" UUID NOT NULL REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY ("transactionId", "itemId")
);
CREATE INDEX "TransactionItem_itemId_idx" ON "TransactionItem"("itemId");
CREATE TABLE "CashConfirmation" (
  "id" UUID NOT NULL PRIMARY KEY,
  "transactionId" UUID NOT NULL REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "actorId" UUID NOT NULL, "kind" VARCHAR(12) NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" VARCHAR(30) NOT NULL DEFAULT 'USER_REPORTED',
  CONSTRAINT "CashConfirmation_kind_check" CHECK ("kind" IN ('SENT', 'RECEIVED'))
);
CREATE UNIQUE INDEX "CashConfirmation_transactionId_kind_key" ON "CashConfirmation"("transactionId", "kind");
UPDATE "Offer" o SET "currentRevisionId" = r."id" FROM "OfferRevision" r WHERE r."offerId" = o."id" AND r."revisionNo" = o."currentRevisionNo";
-- Freeze only historical facts already captured in the listing/offer; unknown weight stays null.
UPDATE "OfferRevision" r SET "exchangeTerms" = jsonb_build_object(
 'ownerItems', jsonb_build_array(jsonb_build_object(
  'id', lr."itemId", 'itemRevision', lr."itemRevision", 'assessmentId', lr."assessmentId",
  'title', lr."title", 'description', lr."description", 'conditionSummary', lr."conditionDisclosure",
  'categoryCode', lr."categoryCode", 'subcategoryCode', lr."subcategoryCode", 'estimatedWeightGrams', NULL,
  'mediaIds', COALESCE((SELECT jsonb_agg(m."mediaId" ORDER BY m."orderIndex", m."mediaId") FROM "ListingRevisionMedia" m WHERE m."revisionId" = lr."id"), '[]'::jsonb),
  'fromUserId', l."ownerId", 'toUserId', o."bidderId")),
 'bidderItems', jsonb_build_array(o."exchangeSnapshot"), 'cashAdjustment', NULL)
FROM "Offer" o JOIN "Listing" l ON l."id" = o."listingId" JOIN "ListingRevision" lr ON lr."id" = o."listingRevisionId"
WHERE r."offerId" = o."id" AND l."type" = 'EXCHANGE' AND o."exchangeSnapshot" IS NOT NULL;
INSERT INTO "OfferRevisionItem" ("revisionId", "itemId")
 SELECT r."id", (i->>'id')::uuid FROM "OfferRevision" r,
 LATERAL jsonb_array_elements(COALESCE(r."exchangeTerms"->'ownerItems','[]'::jsonb) || COALESCE(r."exchangeTerms"->'bidderItems','[]'::jsonb)) i
 ON CONFLICT DO NOTHING;
INSERT INTO "TransactionItem" ("transactionId", "itemId")
 SELECT t."id", (i->>'id')::uuid FROM "Transaction" t, LATERAL jsonb_array_elements(t."snapshot"->'items') i ON CONFLICT DO NOTHING;
