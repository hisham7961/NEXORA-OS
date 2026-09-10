import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan } from "@/domain/mutation";

/**
 * Data-quality checks (§Phase4-85). A focused set of go-live-readiness checks — not
 * hundreds of arbitrary rules. Each reports a count of records with a fixable gap.
 * Read-only: never modifies data.
 */
export interface QualityCheck { key: string; label: string; description: string; count: number; severity: "warning" | "info" }

export async function runDataQuality(principal: Principal): Promise<{ checks: QualityCheck[]; total: number }> {
  assertCan(principal, "settings.view");
  const [
    productsNoSku, productsNoCategory, storesNoCountry, docsNoOwner, subsNoOwner,
    employeesNoCompany, customersNoCurrency, accountsSettingsMissingAR,
  ] = await Promise.all([
    prisma.product.count({ where: { archivedAt: null, sku: "" } }),
    prisma.product.count({ where: { archivedAt: null, category: null } }),
    prisma.store.count({ where: { archivedAt: null, countryId: null } }),
    prisma.document.count({ where: { archivedAt: null, ownerId: null } }).catch(() => 0),
    prisma.subscription.count({ where: { archivedAt: null, ownerId: null } }).catch(() => 0),
    prisma.employee.count({ where: { archivedAt: null, companyId: null } }).catch(() => 0),
    prisma.customer.count({ where: { archivedAt: null, currency: null } }),
    prisma.companyAccountingSettings.count({ where: { receivableAccountId: null } }),
  ]);

  const checks: QualityCheck[] = [
    { key: "product_sku", label: "Products missing SKU", description: "Products with a blank stock-keeping unit.", count: productsNoSku, severity: "warning" },
    { key: "product_category", label: "Products missing category", description: "Products not assigned to a category.", count: productsNoCategory, severity: "info" },
    { key: "store_country", label: "Stores missing country", description: "Stores without a market/country.", count: storesNoCountry, severity: "warning" },
    { key: "doc_owner", label: "Documents without owner", description: "Documents with no responsible owner.", count: docsNoOwner, severity: "info" },
    { key: "sub_owner", label: "Subscriptions without owner", description: "Subscriptions with no responsible owner.", count: subsNoOwner, severity: "info" },
    { key: "emp_company", label: "Employees without company", description: "Employees not assigned to a legal company.", count: employeesNoCompany, severity: "info" },
    { key: "cust_currency", label: "Customers without currency", description: "Customers with no billing currency (defaults to company base).", count: customersNoCurrency, severity: "info" },
    { key: "acct_receivable", label: "Companies missing AR account", description: "Companies with accounting settings but no receivable control account mapped.", count: accountsSettingsMissingAR, severity: "warning" },
  ];
  return { checks, total: checks.reduce((s, c) => s + c.count, 0) };
}
