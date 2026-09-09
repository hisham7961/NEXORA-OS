import { z } from "zod";
import { prisma } from "@/lib/db";
import { accessibleScopeIds, assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";

/** Companies list query = base list params + module-specific filters. */
export const companyQuerySchema = listQuerySchema.extend({ status: z.string().optional() });
export type CompanyQuery = z.infer<typeof companyQuerySchema>;

/**
 * A Company's OWN id is the `companyId` scope value (like Brand.id is the
 * `brandId`). Filter the list to the companies the principal can reach.
 */
function companyScopeWhere(principal: Principal): Record<string, unknown> {
  const ids = accessibleScopeIds(principal, "companies.view", "companyId");
  return ids === "all" ? {} : { id: { in: ids } };
}

export interface CompanyRow {
  id: string;
  name: string;
  code: string;
  baseCurrency: string;
  status: string;
  logoColor: string | null;
  brandCount: number;
  employeeCount: number;
}

export async function listCompanies(
  principal: Principal,
  query: CompanyQuery,
): Promise<{ rows: CompanyRow[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...companyScopeWhere(principal),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { code: { contains: query.q, mode: "insensitive" } }] } : {}),
  };

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.company.count({ where }),
  ]);

  const ids = companies.map((c) => c.id);
  const [brandGroups, employeeGroups] = await Promise.all([
    prisma.brandCompany.groupBy({ by: ["companyId"], where: { companyId: { in: ids } }, _count: true }),
    prisma.employee.groupBy({ by: ["companyId"], where: { companyId: { in: ids }, archivedAt: null }, _count: true }),
  ]);
  const bc = new Map(brandGroups.map((g) => [g.companyId, g._count]));
  const ec = new Map(employeeGroups.map((g) => [g.companyId, g._count]));

  return {
    rows: companies.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      baseCurrency: c.baseCurrency,
      status: c.status,
      logoColor: c.logoColor,
      brandCount: (bc.get(c.id) as number) ?? 0,
      employeeCount: (ec.get(c.id) as number) ?? 0,
    })),
    total,
  };
}

export async function getCompany(principal: Principal, id: string) {
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) return null;
  // Fail-closed scope guard (§69): a company-scoped user cannot open another company.
  assertRecordInScope(principal, "companies.view", { companyId: company.id }, ["companyId"]);

  const [brandLinks, employees, accounts, accountCount, fiscalYears] = await Promise.all([
    prisma.brandCompany.findMany({ where: { companyId: id } }),
    prisma.employee.findMany({
      where: { companyId: id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.account.findMany({
      where: { companyId: id },
      orderBy: [{ type: "asc" }, { code: "asc" }],
      take: 200,
    }),
    prisma.account.count({ where: { companyId: id } }),
    prisma.fiscalYear.findMany({ where: { companyId: id }, orderBy: { startDate: "desc" } }),
  ]);

  return { company, brandLinks, employees, accounts, accountCount, fiscalYears };
}
