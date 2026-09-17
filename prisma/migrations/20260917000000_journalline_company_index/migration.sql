-- ARCH-06: composite index for company-scoped ledger-balance aggregation.
-- Every financial report groups "JournalLine" by "accountId" filtered on "companyId".
CREATE INDEX IF NOT EXISTS "JournalLine_companyId_accountId_idx" ON "JournalLine" ("companyId", "accountId");
