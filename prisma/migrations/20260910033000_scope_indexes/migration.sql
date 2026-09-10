-- CreateIndex
CREATE INDEX "Campaign_companyId_idx" ON "Campaign"("companyId");
-- CreateIndex
CREATE INDEX "CustomerCase_companyId_idx" ON "CustomerCase"("companyId");
-- CreateIndex
CREATE INDEX "CustomerCase_countryId_idx" ON "CustomerCase"("countryId");
-- CreateIndex
CREATE INDEX "DesignRequest_companyId_idx" ON "DesignRequest"("companyId");
-- CreateIndex
CREATE INDEX "DesignRequest_countryId_idx" ON "DesignRequest"("countryId");
-- CreateIndex
CREATE INDEX "Document_companyId_idx" ON "Document"("companyId");
-- CreateIndex
CREATE INDEX "Document_countryId_idx" ON "Document"("countryId");
-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");
-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");
-- CreateIndex
CREATE INDEX "PublishingItem_countryId_idx" ON "PublishingItem"("countryId");
-- CreateIndex
CREATE INDEX "Store_companyId_idx" ON "Store"("companyId");
-- CreateIndex
CREATE INDEX "Subscription_companyId_idx" ON "Subscription"("companyId");
-- CreateIndex
CREATE INDEX "Subscription_brandId_idx" ON "Subscription"("brandId");
-- CreateIndex
CREATE INDEX "Subscription_countryId_idx" ON "Subscription"("countryId");
-- CreateIndex
CREATE INDEX "WhatsappCampaign_countryId_idx" ON "WhatsappCampaign"("countryId");
