-- ARCH-07: company-scoped index for the registrations hot list (mirrors countryId+status).
CREATE INDEX IF NOT EXISTS "RegistrationCase_companyId_status_idx" ON "RegistrationCase" ("companyId", "status");
