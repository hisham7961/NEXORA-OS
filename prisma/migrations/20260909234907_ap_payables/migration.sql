-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "journalEntryId" TEXT,
ADD COLUMN     "paymentAccountId" TEXT,
ADD COLUMN     "postedAt" TIMESTAMP(3),
ADD COLUMN     "postedById" TEXT,
ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "taxAmount" DECIMAL(65,30) DEFAULT 0;

-- AlterTable
ALTER TABLE "ExpenseCategory" ADD COLUMN     "defaultAccountId" TEXT,
ADD COLUMN     "taxRateId" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "addressJson" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "brandId" TEXT,
ADD COLUMN     "countryId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "payableAccountId" TEXT,
ADD COLUMN     "paymentTermsDays" INTEGER,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "SupplierBill" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "billNumber" TEXT,
    "supplierRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'KWD',
    "baseCurrency" TEXT NOT NULL DEFAULT 'KWD',
    "exchangeRate" DECIMAL(65,30),
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountDue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalBase" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "brandId" TEXT,
    "countryId" TEXT,
    "departmentId" TEXT,
    "campaignId" TEXT,
    "storeId" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "journalEntryId" TEXT,
    "createdById" TEXT,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierBillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineNet" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expenseAccountId" TEXT,
    "productId" TEXT,
    "brandId" TEXT,
    "countryId" TEXT,
    "departmentId" TEXT,
    "campaignId" TEXT,
    "storeId" TEXT,
    "costCenterId" TEXT,

    CONSTRAINT "SupplierBillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCredit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "creditNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KWD',
    "baseCurrency" TEXT NOT NULL DEFAULT 'KWD',
    "exchangeRate" DECIMAL(65,30),
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountApplied" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountRemaining" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalBase" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "brandId" TEXT,
    "countryId" TEXT,
    "reason" TEXT,
    "reference" TEXT,
    "journalEntryId" TEXT,
    "createdById" TEXT,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCreditLine" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineNet" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expenseAccountId" TEXT,
    "productId" TEXT,
    "brandId" TEXT,
    "countryId" TEXT,
    "departmentId" TEXT,
    "campaignId" TEXT,
    "storeId" TEXT,
    "costCenterId" TEXT,

    CONSTRAINT "SupplierCreditLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "paymentNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KWD',
    "baseCurrency" TEXT NOT NULL DEFAULT 'KWD',
    "exchangeRate" DECIMAL(65,30),
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "allocatedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unappliedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountBase" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "bankAccountId" TEXT,
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "brandId" TEXT,
    "countryId" TEXT,
    "journalEntryId" TEXT,
    "createdById" TEXT,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillPaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCreditApplication" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCreditApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierBill_companyId_status_idx" ON "SupplierBill"("companyId", "status");

-- CreateIndex
CREATE INDEX "SupplierBill_supplierId_idx" ON "SupplierBill"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierBill_dueDate_idx" ON "SupplierBill"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierBill_companyId_billNumber_key" ON "SupplierBill"("companyId", "billNumber");

-- CreateIndex
CREATE INDEX "SupplierBillLine_billId_idx" ON "SupplierBillLine"("billId");

-- CreateIndex
CREATE INDEX "SupplierCredit_companyId_status_idx" ON "SupplierCredit"("companyId", "status");

-- CreateIndex
CREATE INDEX "SupplierCredit_supplierId_idx" ON "SupplierCredit"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCredit_companyId_creditNumber_key" ON "SupplierCredit"("companyId", "creditNumber");

-- CreateIndex
CREATE INDEX "SupplierCreditLine_creditId_idx" ON "SupplierCreditLine"("creditId");

-- CreateIndex
CREATE INDEX "SupplierPayment_companyId_status_idx" ON "SupplierPayment"("companyId", "status");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_companyId_paymentNumber_key" ON "SupplierPayment"("companyId", "paymentNumber");

-- CreateIndex
CREATE INDEX "BillPaymentAllocation_billId_idx" ON "BillPaymentAllocation"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "BillPaymentAllocation_paymentId_billId_key" ON "BillPaymentAllocation"("paymentId", "billId");

-- CreateIndex
CREATE INDEX "SupplierCreditApplication_billId_idx" ON "SupplierCreditApplication"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCreditApplication_creditId_billId_key" ON "SupplierCreditApplication"("creditId", "billId");

-- CreateIndex
CREATE INDEX "Supplier_companyId_isActive_idx" ON "Supplier"("companyId", "isActive");

-- AddForeignKey
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBillLine" ADD CONSTRAINT "SupplierBillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCredit" ADD CONSTRAINT "SupplierCredit_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditLine" ADD CONSTRAINT "SupplierCreditLine_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "SupplierCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPaymentAllocation" ADD CONSTRAINT "BillPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SupplierPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPaymentAllocation" ADD CONSTRAINT "BillPaymentAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditApplication" ADD CONSTRAINT "SupplierCreditApplication_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "SupplierCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditApplication" ADD CONSTRAINT "SupplierCreditApplication_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
