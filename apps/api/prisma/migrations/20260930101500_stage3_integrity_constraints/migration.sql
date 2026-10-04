CREATE UNIQUE INDEX "Listing_one_open_per_item_idx"
  ON "Listing" ("itemId")
  WHERE "status" IN ('ACTIVE', 'RESERVED');

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_participants_ordered_check"
  CHECK ("participantAId" < "participantBId");

ALTER TABLE "UserBlock"
  ADD CONSTRAINT "UserBlock_distinct_users_check"
  CHECK ("blockerId" <> "blockedId");

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_sequence_positive_check"
  CHECK ("sequence" > 0);

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_read_cursor_check"
  CHECK ("readSequenceA" <= "messageSequence" AND "readSequenceB" <= "messageSequence");
