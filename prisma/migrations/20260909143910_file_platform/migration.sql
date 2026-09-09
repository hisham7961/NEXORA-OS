-- AlterTable
ALTER TABLE "File" ADD COLUMN     "brandId" TEXT,
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'document',
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "countryId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "tagsJson" TEXT;

-- AlterTable
ALTER TABLE "FileVersion" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "mimeType" TEXT;

-- CreateTable
CREATE TABLE "FileAttachment" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileAttachment_entityType_entityId_idx" ON "FileAttachment"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "FileAttachment_fileId_entityType_entityId_key" ON "FileAttachment"("fileId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "File_brandId_idx" ON "File"("brandId");

-- CreateIndex
CREATE INDEX "File_category_idx" ON "File"("category");

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
