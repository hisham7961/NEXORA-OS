-- AlterTable
ALTER TABLE "KnowledgeArticle" ADD COLUMN     "countryId" TEXT,
ADD COLUMN     "currentVersionId" TEXT,
ADD COLUMN     "productId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'draft';

-- CreateTable
CREATE TABLE "KnowledgeVersion" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "authorId" TEXT,
    "approvedById" TEXT,
    "changeNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeVersion_articleId_idx" ON "KnowledgeVersion"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeVersion_articleId_version_key" ON "KnowledgeVersion"("articleId", "version");

-- AddForeignKey
ALTER TABLE "KnowledgeVersion" ADD CONSTRAINT "KnowledgeVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
