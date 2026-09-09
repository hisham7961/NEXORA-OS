import { z } from "zod";
import type { Store } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";

/** E-commerce stores (§16). */
export const storeQuerySchema = listQuerySchema.extend({ platform: z.string().optional(), brandId: z.string().optional() });
export type StoreQuery = z.infer<typeof storeQuerySchema>;

export async function listStores(principal: Principal, query: StoreQuery): Promise<{ rows: Store[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "stores.view", DIMS_CBC, {
      ...(query.platform ? { platform: query.platform } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.store.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.store.count({ where }),
  ]);
  return { rows, total };
}

export async function getStore(principal: Principal, id: string) {
  const store = await prisma.store.findUnique({
    where: { id },
    include: { responsibles: true, performance: { orderBy: { periodStart: "desc" }, take: 12 } },
  });
  if (!store) return null;
  assertRecordInScope(principal, "stores.view", { companyId: store.companyId, brandId: store.brandId, countryId: store.countryId }, DIMS_CBC);
  return store;
}

/** Sales overview: aggregate performance across accessible stores (§16). */
export async function getSalesOverview(principal: Principal) {
  const storeWhere = { archivedAt: null, ...scopedWhere(principal, "sales.view", DIMS_CBC, {}) };
  const stores = await prisma.store.findMany({ where: storeWhere, select: { id: true, name: true } });
  const ids = stores.map((s) => s.id);
  const nameMap = new Map(stores.map((s) => [s.id, s.name]));
  const perf = ids.length
    ? await prisma.storePerformance.findMany({ where: { storeId: { in: ids } }, orderBy: { periodStart: "desc" }, take: 50 })
    : [];
  const totals = perf.reduce(
    (acc, p) => {
      acc.sales += Number(p.sales ?? 0);
      acc.orders += p.orders ?? 0;
      acc.returns += p.returns ?? 0;
      acc.margin += Number(p.grossMargin ?? 0);
      return acc;
    },
    { sales: 0, orders: 0, returns: 0, margin: 0 },
  );
  return { storeCount: stores.length, totals, rows: perf.map((p) => ({ ...p, storeName: nameMap.get(p.storeId) ?? "—" })) };
}
