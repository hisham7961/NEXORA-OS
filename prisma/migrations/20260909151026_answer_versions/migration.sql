-- AlterTable
ALTER TABLE "ApprovedAnswer" ADD COLUMN     "authorId" TEXT,
ADD COLUMN     "currentVersionId" TEXT,
ALTER COLUMN "answer" SET DEFAULT '',
ALTER COLUMN "status" SET DEFAULT 'draft';

-- CreateTable
CREATE TABLE "AnswerVersion" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "authorId" TEXT,
    "approvedById" TEXT,
    "changeNote" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerUsage" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "versionId" TEXT,
    "userId" TEXT,
    "caseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnswerVersion_answerId_idx" ON "AnswerVersion"("answerId");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerVersion_answerId_version_key" ON "AnswerVersion"("answerId", "version");

-- CreateIndex
CREATE INDEX "AnswerUsage_answerId_idx" ON "AnswerUsage"("answerId");

-- CreateIndex
CREATE INDEX "AnswerUsage_caseId_idx" ON "AnswerUsage"("caseId");

-- AddForeignKey
ALTER TABLE "AnswerVersion" ADD CONSTRAINT "AnswerVersion_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "ApprovedAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
