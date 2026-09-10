-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "companyId" TEXT,
    "fileName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "total" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_resource_idx" ON "ImportBatch"("resource");

-- CreateIndex
CREATE INDEX "ImportBatch_createdById_idx" ON "ImportBatch"("createdById");
