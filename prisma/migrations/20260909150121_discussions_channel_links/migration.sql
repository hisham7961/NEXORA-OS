-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "countryId" TEXT,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "lastMessageAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Channel_entityType_entityId_idx" ON "Channel"("entityType", "entityId");
