-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "baseCurrency" TEXT NOT NULL DEFAULT 'KWD',
ADD COLUMN     "documentDate" TIMESTAMP(3),
ADD COLUMN     "journalId" TEXT,
ADD COLUMN     "journalNumber" TEXT,
ADD COLUMN     "postingDate" TIMESTAMP(3),
ADD COLUMN     "reversalOfEntryId" TEXT,
ADD COLUMN     "reversedByEntryId" TEXT,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT,
ADD COLUMN     "totalCreditBase" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "totalDebitBase" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "JournalLine" DROP COLUMN "amountBase",
DROP COLUMN "currency",
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "exchangeRate" DECIMAL(65,30),
ADD COLUMN     "lineNo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "transactionAmount" DECIMAL(65,30),
ADD COLUMN     "transactionCurrency" TEXT;

-- CreateIndex
CREATE INDEX "JournalEntry_companyId_postingDate_idx" ON "JournalEntry"("companyId", "postingDate");

-- CreateIndex
CREATE INDEX "JournalEntry_sourceType_sourceId_idx" ON "JournalEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_companyId_journalNumber_key" ON "JournalEntry"("companyId", "journalNumber");

-- CreateIndex
CREATE INDEX "JournalLine_productId_idx" ON "JournalLine"("productId");

-- CreateIndex
CREATE INDEX "JournalLine_campaignId_idx" ON "JournalLine"("campaignId");

-- CreateIndex
CREATE INDEX "JournalLine_storeId_idx" ON "JournalLine"("storeId");

-- CreateIndex
CREATE INDEX "JournalLine_customerId_idx" ON "JournalLine"("customerId");

-- CreateIndex
CREATE INDEX "JournalLine_supplierId_idx" ON "JournalLine"("supplierId");

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

