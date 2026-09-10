import { z } from "zod";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { scopedWhere } from "@/domain/scope";
import { getLookups, refName } from "@/domain/lookups";
import { SOURCE_BY_KEY, OPERATORS, type ReportField, type ReportSource } from "@/lib/reports/field-registry";

/**
 * Operational Report Builder engine (§Phase4-13/14/15). Reports are built ONLY from
 * the field registry — no raw SQL, no arbitrary columns. Every report enforces the
 * source's permission AND the caller's current scope (company/brand/country), so a
 * saved report re-run after a permission change reflects the new access. Aggregations
 * use Prisma's typed query builders.
 */
export const reportConfigSchema = z.object({
  source: z.string().min(1),
  columns: z.array(z.string()).default([]),
  filters: z.array(z.object({ field: z.string(), op: z.string(), value: z.string() })).default([]),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.object({ field: z.string(), dir: z.enum(["asc", "desc"]) }).optional(),
  groupBy: z.string().optional(),
  aggregate: z.object({ fn: z.enum(["count", "sum"]), field: z.string().optional() }).optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
});
export type ReportConfig = z.infer<typeof reportConfigSchema>;

function fieldOf(source: ReportSource, key: string): ReportField {
  const f = source.fields.find((x) => x.key === key);
  if (!f) throw new ServiceError("bad_field", `Field "${key}" is not available on ${source.label}.`, 422);
  return f;
}

function buildFilter(source: ReportSource, field: string, op: string, value: string): Record<string, unknown> {
  const f = fieldOf(source, field);
  if (!OPERATORS[f.type].includes(op)) throw new ServiceError("bad_op", `Operator "${op}" not allowed on ${f.label}.`, 422);
  switch (op) {
    case "contains": return { [field]: { contains: value, mode: "insensitive" } };
    case "eq": return { [field]: f.type === "number" ? Number(value) : f.type === "boolean" ? value === "true" : value };
    case "in": return { [field]: { in: value.split(",").map((v) => v.trim()).filter(Boolean) } };
    case "gt": case "gte": case "lt": case "lte": return { [field]: { [op]: f.type === "date" ? new Date(value) : Number(value) } };
    default: throw new ServiceError("bad_op", "Unsupported operator.", 422);
  }
}

/** Run a report from the registry, enforcing permission + scope. Returns rows or grouped aggregates. */
export async function runReport(principal: Principal, raw: unknown) {
  const cfg = reportConfigSchema.parse(raw);
  const source = SOURCE_BY_KEY.get(cfg.source);
  if (!source) throw new ServiceError("bad_source", "Unknown report source.", 404);
  assertCan(principal, source.permission);

  // Scope + registry filters.
  const where: Record<string, unknown> = { ...scopedWhere(principal, source.permission, source.scopeDims, {}) };
  const and: Record<string, unknown>[] = [];
  for (const flt of cfg.filters) and.push(buildFilter(source, flt.field, flt.op, flt.value));
  if ((cfg.from || cfg.to) && source.dateField) {
    fieldOf(source, source.dateField);
    and.push({ [source.dateField]: { ...(cfg.from ? { gte: new Date(cfg.from) } : {}), ...(cfg.to ? { lte: new Date(cfg.to) } : {}) } });
  }
  if (and.length) where.AND = and;
  where.archivedAt = null; // all registered sources are soft-deletable

  const model = (prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<Record<string, unknown>[]>; groupBy: (a: unknown) => Promise<Record<string, unknown>[]> }>)[source.model];

  // Aggregated report.
  if (cfg.groupBy && cfg.aggregate) {
    const gb = cfg.groupBy;
    const gf = fieldOf(source, gb);
    const agg = cfg.aggregate;
    if (agg.fn === "sum" && !agg.field) throw new ServiceError("bad_aggregate", "Sum needs a numeric field.", 422);
    if (agg.field) { const af = fieldOf(source, agg.field); if (af.type !== "number") throw new ServiceError("bad_aggregate", "Sum requires a numeric field.", 422); }
    const grouped = await model.groupBy({ by: [gb], where, ...(agg.fn === "sum" ? { _sum: { [agg.field!]: true } } : {}), _count: { _all: true } });
    const isRef = ["brandId", "countryId", "productId", "companyId"].includes(gb);
    const lookups = isRef ? await getLookups() : null;
    const rows = grouped.map((g) => {
      const keyVal = g[gb] as string | null;
      const label = isRef && lookups ? refName(gb === "brandId" ? lookups.brands : gb === "countryId" ? lookups.countries : gb === "productId" ? lookups.products : lookups.companies, keyVal) : (keyVal ?? "—");
      const count = (g._count as { _all: number })._all;
      const sum = agg.fn === "sum" ? Number((g._sum as Record<string, unknown>)[agg.field!] ?? 0) : null;
      return { group: label, count, sum };
    }).sort((a, b) => (b.sum ?? b.count) - (a.sum ?? a.count));
    return { kind: "aggregate" as const, source: source.key, label: source.label, groupBy: gf.label, aggregate: agg, rows };
  }

  // Detail report.
  const columns = cfg.columns.length ? cfg.columns.map((c) => fieldOf(source, c).key) : source.fields.slice(0, 5).map((f) => f.key);
  const select: Record<string, boolean> = { id: true };
  for (const c of columns) select[c] = true;
  const orderBy = cfg.sort ? { [fieldOf(source, cfg.sort.field).key]: cfg.sort.dir } : undefined;
  const rows = await model.findMany({ where, select, orderBy, take: cfg.limit });
  // Resolve ref columns to names.
  const refCols = columns.filter((c) => ["brandId", "countryId", "productId", "companyId"].includes(c));
  const lookups = refCols.length ? await getLookups() : null;
  const display = rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const c of columns) {
      const v = r[c];
      if (lookups && refCols.includes(c)) o[c] = refName(c === "brandId" ? lookups.brands : c === "countryId" ? lookups.countries : c === "productId" ? lookups.products : lookups.companies, v as string | null);
      else if (v instanceof Date) o[c] = v.toISOString().slice(0, 10);
      else o[c] = v ?? "";
    }
    return o;
  });
  return { kind: "detail" as const, source: source.key, label: source.label, columns: columns.map((c) => ({ key: c, label: fieldOf(source, c).label })), rows: display };
}
