ALTER TABLE "ExplanationCache"
  ADD COLUMN "source" VARCHAR(12) NOT NULL DEFAULT 'TEMPLATE',
  ADD COLUMN "model" VARCHAR(160),
  ADD COLUMN "promptVersion" VARCHAR(40),
  ADD COLUMN "expiresAt" TIMESTAMP(3);
CREATE INDEX "ExplanationCache_expiresAt_idx" ON "ExplanationCache"("expiresAt");
CREATE TABLE "ExplanationLease" (
  "key" VARCHAR(80) NOT NULL,
  "token" UUID NOT NULL,
  "assessmentId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExplanationLease_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "ExplanationLease_expiresAt_idx" ON "ExplanationLease"("expiresAt");
