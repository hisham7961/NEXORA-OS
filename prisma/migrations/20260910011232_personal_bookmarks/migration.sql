-- AlterTable
ALTER TABLE "Favorite" ADD COLUMN     "href" TEXT,
ADD COLUMN     "label" TEXT;

-- AlterTable
ALTER TABLE "RecentItem" ADD COLUMN     "href" TEXT,
ADD COLUMN     "label" TEXT;

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");
