-- CreateTable
CREATE TABLE "BankStatement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT,
    "statementFrom" TIMESTAMP(3),
    "statementTo" TIMESTAMP(3),
    "openingBalance" DECIMAL(65,30),
    "closingBalance" DECIMAL(65,30),
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "valueDate" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT,
    "runningBalance" DECIMAL(65,30),
    "dedupeKey" TEXT NOT NULL,
    "matchedJournalLineId" TEXT,
    "reconciliationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unmatched',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankStatement_companyId_bankAccountId_idx" ON "BankStatement"("companyId", "bankAccountId");

-- CreateIndex
CREATE INDEX "BankStatementLine_bankAccountId_status_idx" ON "BankStatementLine"("bankAccountId", "status");

-- CreateIndex
CREATE INDEX "BankStatementLine_statementId_idx" ON "BankStatementLine"("statementId");

-- CreateIndex
CREATE INDEX "BankStatementLine_dedupeKey_idx" ON "BankStatementLine"("dedupeKey");

-- AddForeignKey
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
