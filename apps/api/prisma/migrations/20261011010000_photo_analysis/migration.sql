CREATE TABLE "PhotoAnalysisCache" (
  "key" VARCHAR(80) NOT NULL,
  "actorId" UUID NOT NULL,
  "output" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhotoAnalysisCache_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "PhotoAnalysisCache_actorId_expiresAt_idx" ON "PhotoAnalysisCache"("actorId", "expiresAt");
CREATE INDEX "PhotoAnalysisCache_expiresAt_idx" ON "PhotoAnalysisCache"("expiresAt");
CREATE TABLE "PhotoAnalysisLease" (
  "key" VARCHAR(80) NOT NULL,
  "token" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhotoAnalysisLease_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "PhotoAnalysisLease_expiresAt_idx" ON "PhotoAnalysisLease"("expiresAt");
