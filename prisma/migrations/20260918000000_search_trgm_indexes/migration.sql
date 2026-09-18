-- ARCH-09: trigram indexes so global search's leading-wildcard ILIKE '%q%' becomes
-- index-accelerated (sargable) instead of a sequential scan at scale. Postgres uses a
-- GIN gin_trgm_ops index to satisfy `column ILIKE '%term%'`. pg_trgm is a trusted
-- extension, so the DB owner can create it without superuser.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Brand_name_trgm" ON "Brand" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_name_trgm" ON "Product" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_sku_trgm" ON "Product" USING gin ("sku" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Campaign_name_trgm" ON "Campaign" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Task_title_trgm" ON "Task" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "CustomerCase_description_trgm" ON "CustomerCase" USING gin ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "RegistrationCase_regNumber_trgm" ON "RegistrationCase" USING gin ("registrationNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Subscription_provider_trgm" ON "Subscription" USING gin ("provider" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Subscription_plan_trgm" ON "Subscription" USING gin ("plan" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Store_name_trgm" ON "Store" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Message_body_trgm" ON "Message" USING gin ("body" gin_trgm_ops);
