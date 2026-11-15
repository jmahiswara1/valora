-- Store a reference only. Private coordination details retain their existing access and retention rules.
ALTER TABLE "Message" ADD COLUMN "handoverProposalId" UUID;
CREATE UNIQUE INDEX "Message_handoverProposalId_key" ON "Message"("handoverProposalId");
ALTER TABLE "Message" ADD CONSTRAINT "Message_handoverProposalId_fkey"
  FOREIGN KEY ("handoverProposalId") REFERENCES "HandoverProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
