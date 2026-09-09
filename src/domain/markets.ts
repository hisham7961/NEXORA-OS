import { z } from "zod";
import { prisma } from "@/lib/db";
import { listQuerySchema } from "@/lib/api/pagination";

/**
 * Markets are the global Country master data (§14). The Country model has no
 * `archivedAt` and no company/brand/country scope columns — it is shared reference
 * data visible to anyone who can view the module, so access is gated purely by
 * the `markets.view` permission at the page level (no per-record scope filter).
 */
export const marketQuerySchema = listQuerySchema.extend({ region: z.string().optional() });
export type MarketQuery = z.infer<typeof marketQuerySchema>;

export interface MarketRow {
  id: string;
  name: string;
  iso2: string;
  currency: string;
  region: string | null;
  isActive: boolean;
  brandCount: number;
}

export async function listMarkets(query: MarketQuery): Promise<{ rows: MarketRow[]; total: number }> {
  const where: Record<string, unknown> = {
    ...(query.region ? { region: query.region } : {}),
    ...(query.q ? { OR: [{ name: { contains: query.q } }, { iso2: { contains: query.q } }] } : {}),
  };

  const [countries, total] = await Promise.all([
    prisma.country.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.country.count({ where }),
  ]);

  const ids = countries.map((c) => c.id);
  const brandGroups = await prisma.brandMarket.groupBy({
    by: ["countryId"],
    where: { countryId: { in: ids }, status: "active" },
    _count: true,
  });
  const bc = new Map(brandGroups.map((g) => [g.countryId, g._count]));

  return {
    rows: countries.map((c) => ({
      id: c.id,
      name: c.name,
      iso2: c.iso2,
      currency: c.currency,
      region: c.region,
      isActive: c.isActive,
      brandCount: (bc.get(c.id) as number) ?? 0,
    })),
    total,
  };
}

export async function getMarket(id: string) {
  const country = await prisma.country.findUnique({ where: { id } });
  if (!country) return null;

  const [brandMarkets, registrationCount, documentCount] = await Promise.all([
    prisma.brandMarket.findMany({ where: { countryId: id }, orderBy: { launchedAt: "desc" } }),
    prisma.registrationCase.count({ where: { countryId: id, archivedAt: null } }),
    prisma.document.count({ where: { countryId: id, archivedAt: null } }),
  ]);

  return { country, brandMarkets, registrationCount, documentCount };
}
