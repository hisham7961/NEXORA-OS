-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "remindersSentJson" TEXT;

-- CreateTable
CREATE TABLE "AttendanceCorrection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "requestedValue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    "requestedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceCorrection_userId_status_idx" ON "AttendanceCorrection"("userId", "status");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_status_idx" ON "AttendanceCorrection"("status");
