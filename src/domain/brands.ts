import { z } from "zod";
import { prisma } from "@/lib/db";
import { accessibleScopeIds, assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";

/** Brands list query = base list params + module-specific filters. */
export const brandQuerySchema = listQuerySchema.extend({ status: z.string().optional() });
export type BrandQuery = z.infer<typeof brandQuerySchema>;

/** Filter a scalar-id list by the principal's accessible brand scope. */
function brandScopeWhere(principal: Principal): Record<string, unknown> {
  const ids = accessibleScopeIds(principal, "brands.view", "brandId");
  return ids === "all" ? {} : { id: { in: ids } };
}

export interface BrandRow {
  id: string;
  name: string;
  code: string;
  status: string;
  accentColor: string | null;
  companyCount: number;
  marketCount: number;
  productCount: number;
}

export async function listBrands(principal: Principal, query: BrandQuery): Promise<{ rows: BrandRow[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...brandScopeWhere(principal),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { OR: [{ name: { contains: query.q } }, { code: { contains: query.q } }] } : {}),
  };

  const [brands, total] = await Promise.all([
    prisma.brand.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.brand.count({ where }),
  ]);

  const ids = brands.map((b) => b.id);
  const [productGroups, marketGroups, companyGroups] = await Promise.all([
    prisma.product.groupBy({ by: ["brandId"], where: { brandId: { in: ids }, archivedAt: null }, _count: true }),
    prisma.brandMarket.groupBy({ by: ["brandId"], where: { brandId: { in: ids } }, _count: true }),
    prisma.brandCompany.groupBy({ by: ["brandId"], where: { brandId: { in: ids } }, _count: true }),
  ]);
  const pc = new Map(productGroups.map((g) => [g.brandId, g._count]));
  const mc = new Map(marketGroups.map((g) => [g.brandId, g._count]));
  const cc = new Map(companyGroups.map((g) => [g.brandId, g._count]));

  return {
    rows: brands.map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      status: b.status,
      accentColor: b.accentColor,
      productCount: (pc.get(b.id) as number) ?? 0,
      marketCount: (mc.get(b.id) as number) ?? 0,
      companyCount: (cc.get(b.id) as number) ?? 0,
    })),
    total,
  };
}

export async function getBrand(principal: Principal, id: string) {
  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) return null;
  // Fail-closed scope guard (§69): a brand-scoped user cannot open another brand.
  assertRecordInScope(principal, "brands.view", { brandId: brand.id }, ["brandId"]);

  const [companyLinks, markets, products, campaigns, registrations, documents, cases, openTasks] = await Promise.all([
    prisma.brandCompany.findMany({ where: { brandId: id } }),
    prisma.brandMarket.findMany({ where: { brandId: id } }),
    prisma.product.findMany({ where: { brandId: id, archivedAt: null }, orderBy: { name: "asc" }, take: 50 }),
    prisma.campaign.findMany({ where: { brandId: id, archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 25 }),
    prisma.registrationCase.findMany({ where: { brandId: id, archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 25 }),
    prisma.document.findMany({ where: { brandId: id, archivedAt: null }, orderBy: { expiryDate: "asc" }, take: 25 }),
    prisma.customerCase.findMany({ where: { brandId: id, archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 25 }),
    prisma.task.count({ where: { brandId: id, archivedAt: null, status: { notIn: ["completed", "cancelled"] } } }),
  ]);

  return { brand, companyLinks, markets, products, campaigns, registrations, documents, cases, openTasks };
}
