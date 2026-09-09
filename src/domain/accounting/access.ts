import { prisma } from "@/lib/db";
import { accessibleScopeIds, type Principal } from "@/lib/permissions/engine";

/** Companies this principal may view accounting for (§72 — company-scoped finance). */
export async function accountingCompanies(principal: Principal) {
  const ids = accessibleScopeIds(principal, "accounting.view", "companyId");
  return prisma.company.findMany({
    where: { archivedAt: null, ...(ids === "all" ? {} : { id: { in: ids } }) },
    select: { id: true, name: true, baseCurrency: true },
    orderBy: { name: "asc" },
  });
}

/** Resolve the selected company id from a `?company=` param, defaulting to the first accessible one. */
export async function resolveAccountingCompany(principal: Principal, selected?: string) {
  const companies = await accountingCompanies(principal);
  const current = companies.find((c) => c.id === selected) ?? companies[0] ?? null;
  return { companies, current };
}
