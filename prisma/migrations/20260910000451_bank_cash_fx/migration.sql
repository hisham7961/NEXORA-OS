-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "glAccountId" TEXT,
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "JournalLine" ADD COLUMN     "reconciledAt" TIMESTAMP(3),
ADD COLUMN     "reconciliationId" TEXT;

-- CreateTable
CREATE TABLE "BankTransfer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "transferNumber" TEXT,
    "fromBankAccountId" TEXT NOT NULL,
    "toBankAccountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "fromAmount" DECIMAL(65,30) NOT NULL,
    "toAmount" DECIMAL(65,30) NOT NULL,
    "exchangeRate" DECIMAL(65,30),
    "baseCurrency" TEXT NOT NULL DEFAULT 'KWD',
    "reference" TEXT,
    "notes" TEXT,
    "journalEntryId" TEXT,
    "createdById" TEXT,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "statementBalance" DECIMAL(65,30) NOT NULL,
    "clearedBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "note" TEXT,
    "createdById" TEXT,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankTransfer_companyId_idx" ON "BankTransfer"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransfer_companyId_transferNumber_key" ON "BankTransfer"("companyId", "transferNumber");

-- CreateIndex
CREATE INDEX "BankReconciliation_companyId_bankAccountId_idx" ON "BankReconciliation"("companyId", "bankAccountId");

-- CreateIndex
CREATE INDEX "BankAccount_companyId_isActive_idx" ON "BankAccount"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "JournalLine_reconciliationId_idx" ON "JournalLine"("reconciliationId");

-- AddForeignKey
ALTER TABLE "BankTransfer" ADD CONSTRAINT "BankTransfer_fromBankAccountId_fkey" FOREIGN KEY ("fromBankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransfer" ADD CONSTRAINT "BankTransfer_toBankAccountId_fkey" FOREIGN KEY ("toBankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
