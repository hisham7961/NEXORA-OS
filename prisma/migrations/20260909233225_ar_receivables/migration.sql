-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "addressJson" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "brandId" TEXT,
ADD COLUMN     "countryId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "creditLimit" DECIMAL(65,30),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentTermsDays" INTEGER,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "receivableAccountId" TEXT,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "SalesInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "documentDate" TIMESTAMP(3),
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

    CONSTRAINT "SalesInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineNet" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "revenueAccountId" TEXT,
    "productId" TEXT,
    "brandId" TEXT,
    "countryId" TEXT,
    "departmentId" TEXT,
    "campaignId" TEXT,
    "storeId" TEXT,
    "costCenterId" TEXT,

    CONSTRAINT "SalesInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "creditNoteNumber" TEXT,
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

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNoteLine" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineNet" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "revenueAccountId" TEXT,
    "productId" TEXT,
    "brandId" TEXT,
    "countryId" TEXT,
    "departmentId" TEXT,
    "campaignId" TEXT,
    "storeId" TEXT,
    "costCenterId" TEXT,

    CONSTRAINT "CreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerReceipt" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "receiptDate" TIMESTAMP(3) NOT NULL,
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

    CONSTRAINT "CustomerReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptAllocation" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNoteApplication" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNoteApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesInvoice_companyId_status_idx" ON "SalesInvoice"("companyId", "status");

-- CreateIndex
CREATE INDEX "SalesInvoice_customerId_idx" ON "SalesInvoice"("customerId");

-- CreateIndex
CREATE INDEX "SalesInvoice_dueDate_idx" ON "SalesInvoice"("dueDate");

-- CreateIndex
CREATE INDEX "SalesInvoice_issueDate_idx" ON "SalesInvoice"("issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_companyId_invoiceNumber_key" ON "SalesInvoice"("companyId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "SalesInvoiceLine_invoiceId_idx" ON "SalesInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "SalesInvoiceLine_productId_idx" ON "SalesInvoiceLine"("productId");

-- CreateIndex
CREATE INDEX "CreditNote_companyId_status_idx" ON "CreditNote"("companyId", "status");

-- CreateIndex
CREATE INDEX "CreditNote_customerId_idx" ON "CreditNote"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_companyId_creditNoteNumber_key" ON "CreditNote"("companyId", "creditNoteNumber");

-- CreateIndex
CREATE INDEX "CreditNoteLine_creditNoteId_idx" ON "CreditNoteLine"("creditNoteId");

-- CreateIndex
CREATE INDEX "CustomerReceipt_companyId_status_idx" ON "CustomerReceipt"("companyId", "status");

-- CreateIndex
CREATE INDEX "CustomerReceipt_customerId_idx" ON "CustomerReceipt"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReceipt_companyId_receiptNumber_key" ON "CustomerReceipt"("companyId", "receiptNumber");

-- CreateIndex
CREATE INDEX "ReceiptAllocation_invoiceId_idx" ON "ReceiptAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptAllocation_receiptId_invoiceId_key" ON "ReceiptAllocation"("receiptId", "invoiceId");

-- CreateIndex
CREATE INDEX "CreditNoteApplication_invoiceId_idx" ON "CreditNoteApplication"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNoteApplication_creditNoteId_invoiceId_key" ON "CreditNoteApplication"("creditNoteId", "invoiceId");

-- CreateIndex
CREATE INDEX "Customer_companyId_isActive_idx" ON "Customer"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "Customer_brandId_idx" ON "Customer"("brandId");

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceLine" ADD CONSTRAINT "SalesInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "CustomerReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteApplication" ADD CONSTRAINT "CreditNoteApplication_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteApplication" ADD CONSTRAINT "CreditNoteApplication_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
