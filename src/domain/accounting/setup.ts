import { z } from "zod";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation";
import { assertFinance } from "./common";

/**
 * Remaining accounting setup masters (§9/§19/§41/§43): journals config, cost
 * centers, exchange rates and tax rates. All company-scoped, audited.
 */

// --- Journals (config) -----------------------------------------------------
export const journalSchema = z.object({
  code: z.string().trim().min(1).max(12),
  name: z.string().trim().min(1).max(80),
  type: z.enum(["general", "sales", "purchase", "bank", "cash", "expense", "adjustment", "opening"]).default("general"),
  numberPrefix: optionalString,
});

export async function listJournals(principal: Principal, companyId: string) {
  assertCan(principal, "accounting.view", { companyId });
  return prisma.journal.findMany({ where: { companyId, archivedAt: null }, orderBy: { code: "asc" } });
}

export async function createJournal(ctx: ActorContext, companyId: string, raw: unknown) {
  assertFinance(ctx, "accounting.manage", companyId);
  const input = journalSchema.parse(raw);
  if (await prisma.journal.findUnique({ where: { companyId_code: { companyId, code: input.code } } })) throw new ServiceError("code_taken", "Journal code already exists.", 422);
  const j = await prisma.journal.create({ data: { companyId, code: input.code, name: input.name, type: input.type, numberPrefix: input.numberPrefix ?? input.code } });
  await audit(ctx, { action: "journal.created", entityType: "Journal", entityId: j.id, summary: `${input.code} ${input.name}`, companyId });
  return j;
}

// --- Cost centers ----------------------------------------------------------
export const costCenterSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: optionalString,
  parentId: optionalString,
  departmentId: optionalString,
  ownerId: optionalString,
});

export async function listCostCenters(principal: Principal, companyId: string) {
  assertCan(principal, "accounting.view", { companyId });
  return prisma.costCenter.findMany({ where: { companyId, archivedAt: null }, orderBy: { name: "asc" } });
}

export async function createCostCenter(ctx: ActorContext, companyId: string, raw: unknown) {
  assertFinance(ctx, "accounting.manage", companyId);
  const input = costCenterSchema.parse(raw);
  const cc = await prisma.costCenter.create({ data: { companyId, name: input.name, code: input.code ?? null, parentId: input.parentId ?? null, departmentId: input.departmentId ?? null, ownerId: input.ownerId ?? null } });
  await audit(ctx, { action: "cost_center.created", entityType: "CostCenter", entityId: cc.id, summary: input.name, companyId });
  return cc;
}

export async function updateCostCenter(ctx: ActorContext, id: string, raw: unknown) {
  const cc = await prisma.costCenter.findUnique({ where: { id } });
  if (!cc || cc.archivedAt) throw new ServiceError("not_found", "Cost center not found", 404);
  assertFinance(ctx, "accounting.manage", cc.companyId ?? "");
  const input = costCenterSchema.partial().parse(raw);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "code", "parentId", "departmentId", "ownerId"] as const) if (input[k] !== undefined) data[k] = input[k] ?? null;
  const updated = await prisma.costCenter.update({ where: { id }, data });
  await audit(ctx, { action: "cost_center.updated", entityType: "CostCenter", entityId: id, summary: updated.name, companyId: cc.companyId });
  return updated;
}

// --- Exchange rates --------------------------------------------------------
export const rateSchema = z.object({
  base: z.string().length(3),
  quote: z.string().length(3),
  rate: z.coerce.number().positive(),
  date: z.coerce.date(),
  source: z.enum(["manual", "api"]).default("manual"),
});

export async function listExchangeRates(principal: Principal, companyId: string) {
  assertCan(principal, "accounting.view", { companyId });
  return prisma.exchangeRate.findMany({ orderBy: [{ date: "desc" }], take: 200 });
}

export async function upsertExchangeRate(ctx: ActorContext, companyId: string, raw: unknown) {
  assertFinance(ctx, "accounting.manage", companyId);
  const input = rateSchema.parse(raw);
  const base = input.base.toUpperCase(), quote = input.quote.toUpperCase();
  const rate = await prisma.exchangeRate.upsert({
    where: { base_quote_date: { base, quote, date: input.date } },
    create: { base, quote, rate: input.rate, date: input.date, source: input.source, enteredById: ctx.principal.userId },
    update: { rate: input.rate, source: input.source, enteredById: ctx.principal.userId },
  });
  await audit(ctx, { action: "exchange_rate.set", entityType: "ExchangeRate", entityId: rate.id, summary: `${base}/${quote} = ${input.rate} @ ${input.date.toISOString().slice(0, 10)}`, companyId });
  return rate;
}

/**
 * Deterministic historical rate resolution (§40/§41): the latest rate on or before
 * `date`. Returns 1 for identical currencies. Throws if no rate is available so a
 * cross-currency post can never silently use a wrong rate.
 */
export async function resolveExchangeRate(base: string, quote: string, date: Date): Promise<number> {
  if (base.toUpperCase() === quote.toUpperCase()) return 1;
  const row = await prisma.exchangeRate.findFirst({
    where: { base: base.toUpperCase(), quote: quote.toUpperCase(), date: { lte: date } },
    orderBy: { date: "desc" },
  });
  if (!row) throw new ServiceError("no_rate", `No exchange rate for ${base}→${quote} on or before ${date.toISOString().slice(0, 10)}.`, 422);
  return Number(row.rate);
}

// --- Tax rates -------------------------------------------------------------
export const taxSchema = z.object({
  name: z.string().trim().min(1).max(80),
  rate: z.coerce.number().min(0).max(100),
  computation: z.enum(["exclusive", "inclusive"]).default("exclusive"),
  countryId: optionalString,
  inputTaxAccountId: optionalString,
  outputTaxAccountId: optionalString,
  effectiveDate: z.preprocess((v) => (v ? new Date(v as string) : undefined), z.date().optional()),
});

export async function listTaxRates(principal: Principal, companyId: string) {
  assertCan(principal, "accounting.view", { companyId });
  return prisma.taxRate.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}

export async function createTaxRate(ctx: ActorContext, companyId: string, raw: unknown) {
  assertFinance(ctx, "accounting.manage", companyId);
  const input = taxSchema.parse(raw);
  const t = await prisma.taxRate.create({ data: { companyId, name: input.name, rate: input.rate, computation: input.computation, countryId: input.countryId ?? null, inputTaxAccountId: input.inputTaxAccountId ?? null, outputTaxAccountId: input.outputTaxAccountId ?? null, effectiveDate: input.effectiveDate ?? null } });
  await audit(ctx, { action: "tax_rate.created", entityType: "TaxRate", entityId: t.id, summary: `${input.name} ${input.rate}%`, companyId });
  return t;
}
