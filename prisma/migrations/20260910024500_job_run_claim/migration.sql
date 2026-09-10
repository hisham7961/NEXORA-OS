-- CreateTable
CREATE TABLE "JobRunClaim" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobRunClaim_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "JobRunClaim_claimedAt_idx" ON "JobRunClaim"("claimedAt");
-- CreateIndex
CREATE UNIQUE INDEX "JobRunClaim_jobName_periodKey_key" ON "JobRunClaim"("jobName", "periodKey");
