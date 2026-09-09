import { z } from "zod";
import type { Store, StorePerformance } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { optionalString, optionalNumber } from "@/lib/validation";

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

// ---------------------------------------------------------------------------
// WRITE PATH (§16, Phase 2 Part P) — record store performance for a period.
// Permission (sales.create in the STORE's scope) → validation → derived metrics
// → idempotent per (store, periodType, periodStart) → audit.
// ---------------------------------------------------------------------------

const PERIOD_TYPES = ["daily", "weekly", "monthly"] as const;

export const performanceInputSchema = z.object({
  periodType: z.enum(PERIOD_TYPES).default("daily"),
  periodStart: z.coerce.date({ invalid_type_error: "A period start date is required" }),
  periodEnd: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date().optional()),
  sales: optionalNumber,
  orders: optionalNumber,
  unitsSold: optionalNumber,
  returns: optionalNumber,
  refunds: optionalNumber,
  adSpend: optionalNumber,
  discounts: optionalNumber,
  shippingCost: optionalNumber,
  cogs: optionalNumber,
  campaignId: optionalString,
  notes: optionalString,
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The authoritative store-performance metric model (see docs/METRIC_DICTIONARY.md).
 * INPUTS are stored as entered; DERIVED values are computed here, server-side,
 * so Accounting and Analytics all read one consistent definition:
 *   Net Sales        = Gross Sales − Discounts − Refunds
 *   AOV              = Net Sales / Orders
 *   Gross Profit     = Net Sales − COGS            (stored in `grossMargin`)
 *   Net Contribution = Gross Profit − Ad Spend − Shipping Cost
 * A component absent (null) is treated as 0 in the arithmetic; a derived value is
 * null only when it has no meaningful inputs (e.g. no gross sales entered).
 */
export function deriveStoreMetrics(input: {
  sales?: number | null; orders?: number | null; refunds?: number | null;
  discounts?: number | null; cogs?: number | null; adSpend?: number | null; shippingCost?: number | null;
}) {
  const sales = input.sales ?? null;
  const netSales = sales != null ? round2(sales - (input.discounts ?? 0) - (input.refunds ?? 0)) : null;
  const orders = input.orders ?? null;
  const aov = netSales != null && orders && orders > 0 ? round2(netSales / orders) : null;
  const grossMargin = netSales != null && input.cogs != null ? round2(netSales - input.cogs) : null;
  const netContribution =
    grossMargin != null ? round2(grossMargin - (input.adSpend ?? 0) - (input.shippingCost ?? 0)) : null;
  return { netSales, aov, grossMargin, netContribution };
}

/**
 * Record (or update) a store's performance for a period. Derived metrics are
 * computed from the entered input components so they can't drift. Re-entering
 * the same period upserts, making imports and manual entry idempotent.
 */
export async function recordStorePerformance(ctx: ActorContext, storeId: string, raw: unknown): Promise<StorePerformance> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || store.archivedAt) throw new ServiceError("not_found", "Store not found", 404);
  assertCan(ctx.principal, "sales.create", { companyId: store.companyId, brandId: store.brandId, countryId: store.countryId });

  const input = performanceInputSchema.parse(raw);
  if (input.periodEnd && input.periodEnd < input.periodStart) {
    throw new ServiceError("invalid_period", "Period end cannot be before the start", 422);
  }

  const { netSales, aov, grossMargin, netContribution } = deriveStoreMetrics({
    sales: input.sales, orders: input.orders, refunds: input.refunds,
    discounts: input.discounts, cogs: input.cogs, adSpend: input.adSpend, shippingCost: input.shippingCost,
  });

  const data = {
    periodType: input.periodType,
    periodEnd: input.periodEnd ?? null,
    sales: input.sales ?? null, orders: input.orders != null ? Math.trunc(input.orders) : null,
    unitsSold: input.unitsSold != null ? Math.trunc(input.unitsSold) : null,
    returns: input.returns != null ? Math.trunc(input.returns) : null,
    refunds: input.refunds ?? null, adSpend: input.adSpend ?? null, discounts: input.discounts ?? null,
    shippingCost: input.shippingCost ?? null, cogs: input.cogs ?? null,
    netSales, aov, grossMargin, netContribution,
    campaignId: input.campaignId ?? null, notes: input.notes ?? null,
  };

  const existing = await prisma.storePerformance.findFirst({
    where: { storeId, periodType: input.periodType, periodStart: input.periodStart },
    select: { id: true },
  });

  const row = existing
    ? await prisma.storePerformance.update({ where: { id: existing.id }, data })
    : await prisma.storePerformance.create({ data: { storeId, periodStart: input.periodStart, ...data } });

  await audit(ctx, {
    action: existing ? "store.performance_updated" : "store.performance_recorded",
    entityType: "Store", entityId: storeId,
    summary: `${input.periodType} ${input.periodStart.toISOString().slice(0, 10)}${input.sales != null ? ` · gross sales ${input.sales}` : ""}`,
    brandId: store.brandId, companyId: store.companyId,
  });
  return row;
}
