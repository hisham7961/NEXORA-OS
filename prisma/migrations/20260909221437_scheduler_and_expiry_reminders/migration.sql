-- AlterTable
ALTER TABLE "BackgroundJob" ADD COLUMN     "lastDurationMs" INTEGER;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "remindersSentJson" TEXT;

-- CreateTable
CREATE TABLE "BackgroundJobRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "jobName" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'scheduled',
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "resultJson" TEXT,
    "error" TEXT,

    CONSTRAINT "BackgroundJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackgroundJobRun_jobName_startedAt_idx" ON "BackgroundJobRun"("jobName", "startedAt");

-- CreateIndex
CREATE INDEX "BackgroundJobRun_status_idx" ON "BackgroundJobRun"("status");

-- AddForeignKey
ALTER TABLE "BackgroundJobRun" ADD CONSTRAINT "BackgroundJobRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BackgroundJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
