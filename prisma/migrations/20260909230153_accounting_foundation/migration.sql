/*
  Warnings:

  - Added the required column `updatedAt` to the `CostCenter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `FiscalYear` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TaxRate` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "allowPosting" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nameLocalized" TEXT,
ADD COLUMN     "normalBalance" TEXT NOT NULL DEFAULT 'debit',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "subtype" TEXT;

-- AlterTable
ALTER TABLE "AccountingPeriod" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "periodType" TEXT NOT NULL DEFAULT 'month',
ADD COLUMN     "reopenNote" TEXT,
ADD COLUMN     "reopenedById" TEXT;

-- AlterTable
ALTER TABLE "CostCenter" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ExchangeRate" ADD COLUMN     "enteredById" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "FiscalYear" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "TaxRate" ADD COLUMN     "computation" TEXT NOT NULL DEFAULT 'exclusive',
ADD COLUMN     "effectiveDate" TIMESTAMP(3),
ADD COLUMN     "inputTaxAccountId" TEXT,
ADD COLUMN     "outputTaxAccountId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "CompanyAccountingSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'KWD',
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuwait',
    "roundingPolicy" TEXT NOT NULL DEFAULT 'half_up',
    "balancingToleranceJson" TEXT,
    "receivableAccountId" TEXT,
    "payableAccountId" TEXT,
    "revenueAccountId" TEXT,
    "cogsAccountId" TEXT,
    "inventoryAccountId" TEXT,
    "bankClearingAccountId" TEXT,
    "cashAccountId" TEXT,
    "inputTaxAccountId" TEXT,
    "outputTaxAccountId" TEXT,
    "retainedEarningsAccountId" TEXT,
    "fxGainAccountId" TEXT,
    "fxLossAccountId" TEXT,
    "suspenseAccountId" TEXT,
    "roundingAccountId" TEXT,
    "journalPrefix" TEXT NOT NULL DEFAULT 'GJ',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "billPrefix" TEXT NOT NULL DEFAULT 'BILL',
    "paymentPrefix" TEXT NOT NULL DEFAULT 'PAY',
    "defaultPaymentTerms" INTEGER NOT NULL DEFAULT 30,
    "lockDate" TIMESTAMP(3),
    "softCloseDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAccountingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "numberPrefix" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberSequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAccountingSettings_companyId_key" ON "CompanyAccountingSettings"("companyId");

-- CreateIndex
CREATE INDEX "CompanyAccountingSettings_companyId_idx" ON "CompanyAccountingSettings"("companyId");

-- CreateIndex
CREATE INDEX "Journal_companyId_idx" ON "Journal"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Journal_companyId_code_key" ON "Journal"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "NumberSequence_companyId_key_key" ON "NumberSequence"("companyId", "key");

-- CreateIndex
CREATE INDEX "Account_parentId_idx" ON "Account"("parentId");

-- CreateIndex
CREATE INDEX "AccountingPeriod_companyId_status_idx" ON "AccountingPeriod"("companyId", "status");

-- CreateIndex
CREATE INDEX "CostCenter_companyId_idx" ON "CostCenter"("companyId");

-- CreateIndex
CREATE INDEX "CostCenter_parentId_idx" ON "CostCenter"("parentId");

-- CreateIndex
CREATE INDEX "ExchangeRate_base_quote_date_idx" ON "ExchangeRate"("base", "quote", "date");

-- CreateIndex
CREATE INDEX "TaxRate_companyId_idx" ON "TaxRate"("companyId");
