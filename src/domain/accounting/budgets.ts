import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation";
import { D, ZERO, add, sub } from "@/lib/money";
import { canFinance } from "./common";

/**
 * Budgets & Budget-vs-Actual (§Increment F). A budget carries per-GL-account
 * budgeted amounts and optional analytical-dimension scope; the variance report
 * compares them to posted GL activity in the same scope. Company-scoped (budgets.*).
 */
export const budgetLineSchema = z.object({
  accountId: z.string().min(1),
  periodMonth: z.coerce.number().int().min(1).max(12).optional(),
  amount: z.coerce.number(),
});

export const budgetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  fiscalYearId: optionalString,
  currency: z.string().length(3).optional(),
  brandId: optionalString,
  countryId: optionalString,
  departmentId: optionalString,
  campaignId: optionalString,
  periodStart: z.preprocess((v) => (v ? new Date(v as string) : undefined), z.date().optional()),
  periodEnd: z.preprocess((v) => (v ? new Date(v as string) : undefined), z.date().optional()),
  notes: optionalString,
  lines: z.array(budgetLineSchema).default([]),
});

export async function listBudgets(principal: Principal, companyId: string) {
  assertCan(principal, "budgets.view", { companyId });
  return prisma.budget.findMany({ where: { companyId, archivedAt: null }, orderBy: { createdAt: "desc" }, include: { _count: { select: { lines: true } } } });
}

export async function getBudget(principal: Principal, id: string) {
  const b = await prisma.budget.findUnique({ where: { id }, include: { lines: true } });
  if (!b) return null;
  if (!canFinance(principal, "budgets.view", b.companyId ?? "")) throw new ServiceError("forbidden", "Forbidden", 403);
  return b;
}

async function assertAccounts(companyId: string, accountIds: string[]) {
  if (!accountIds.length) return;
  const accts = await prisma.account.findMany({ where: { id: { in: accountIds } }, select: { id: true, companyId: true } });
  const byId = new Map(accts.map((a) => [a.id, a]));
  for (const id of accountIds) { const a = byId.get(id); if (!a || a.companyId !== companyId) throw new ServiceError("bad_account", "A budget line account does not belong to this company.", 422); }
}

export async function createBudget(ctx: ActorContext, companyId: string, raw: unknown) {
  assertCan(ctx.principal, "budgets.manage", { companyId });
  const input = budgetSchema.parse(raw);
  await assertAccounts(companyId, [...new Set(input.lines.map((l) => l.accountId))]);
  const total = input.lines.reduce((s, l) => add(s, l.amount), ZERO);
  const b = await prisma.budget.create({
    data: {
      companyId, name: input.name, fiscalYearId: input.fiscalYearId ?? null, currency: (input.currency ?? "KWD").toUpperCase(),
      brandId: input.brandId ?? null, countryId: input.countryId ?? null, departmentId: input.departmentId ?? null, campaignId: input.campaignId ?? null,
      periodStart: input.periodStart ?? null, periodEnd: input.periodEnd ?? null, notes: input.notes ?? null, amount: total, createdById: ctx.principal.userId,
      lines: { create: input.lines.map((l) => ({ accountId: l.accountId, periodMonth: l.periodMonth ?? null, amount: l.amount })) },
    },
    include: { lines: true },
  });
  await audit(ctx, { action: "budget.created", entityType: "Budget", entityId: b.id, summary: `${input.name} (${total})`, companyId });
  return b;
}

export async function updateBudget(ctx: ActorContext, id: string, raw: unknown) {
  const b = await prisma.budget.findUnique({ where: { id } });
  if (!b || b.archivedAt) throw new ServiceError("not_found", "Budget not found", 404);
  assertCan(ctx.principal, "budgets.manage", { companyId: b.companyId ?? "" });
  const input = budgetSchema.parse(raw);
  await assertAccounts(b.companyId ?? "", [...new Set(input.lines.map((l) => l.accountId))]);
  const total = input.lines.reduce((s, l) => add(s, l.amount), ZERO);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.budgetLine.deleteMany({ where: { budgetId: id } });
    return tx.budget.update({
      where: { id },
      data: {
        name: input.name, fiscalYearId: input.fiscalYearId ?? null, currency: (input.currency ?? b.currency).toUpperCase(),
        brandId: input.brandId ?? null, countryId: input.countryId ?? null, departmentId: input.departmentId ?? null, campaignId: input.campaignId ?? null,
        periodStart: input.periodStart ?? null, periodEnd: input.periodEnd ?? null, notes: input.notes ?? null, amount: total,
        lines: { create: input.lines.map((l) => ({ accountId: l.accountId, periodMonth: l.periodMonth ?? null, amount: l.amount })) },
      },
      include: { lines: true },
    });
  });
  await audit(ctx, { action: "budget.updated", entityType: "Budget", entityId: id, summary: updated.name, companyId: b.companyId });
  return updated;
}

export async function setBudgetStatus(ctx: ActorContext, id: string, status: "draft" | "active" | "archived") {
  const b = await prisma.budget.findUnique({ where: { id } });
  if (!b) throw new ServiceError("not_found", "Budget not found", 404);
  assertCan(ctx.principal, "budgets.manage", { companyId: b.companyId ?? "" });
  const updated = await prisma.budget.update({ where: { id }, data: { status, ...(status === "archived" ? { archivedAt: new Date() } : {}) } });
  await audit(ctx, { action: `budget.${status}`, entityType: "Budget", entityId: id, summary: b.name, companyId: b.companyId });
  return updated;
}

/**
 * Budget vs Actual: for each budgeted account, the budgeted amount against posted
 * GL activity (in the account's normal-balance direction) within the budget's
 * period and analytical-dimension scope. Positive variance = under budget for
 * expenses / over target for revenue.
 */
export async function budgetVsActual(principal: Principal, budgetId: string) {
  const budget = await prisma.budget.findUnique({ where: { id: budgetId }, include: { lines: true } });
  if (!budget) throw new ServiceError("not_found", "Budget not found", 404);
  assertCan(principal, "budgets.view", { companyId: budget.companyId ?? "" });

  const fy = budget.fiscalYearId ? await prisma.fiscalYear.findUnique({ where: { id: budget.fiscalYearId } }) : null;
  const from = budget.periodStart ?? fy?.startDate ?? null;
  const to = budget.periodEnd ?? fy?.endDate ?? null;

  const accountIds = [...new Set(budget.lines.map((l) => l.accountId))];
  const accounts = await prisma.account.findMany({ where: { id: { in: accountIds } }, select: { id: true, code: true, name: true, type: true, normalBalance: true } });
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const dimWhere: Prisma.JournalLineWhereInput = {
    companyId: budget.companyId ?? undefined,
    accountId: { in: accountIds },
    entry: { status: "posted", ...(from || to ? { postingDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
    ...(budget.brandId ? { brandId: budget.brandId } : {}),
    ...(budget.countryId ? { countryId: budget.countryId } : {}),
    ...(budget.departmentId ? { departmentId: budget.departmentId } : {}),
    ...(budget.campaignId ? { campaignId: budget.campaignId } : {}),
  };
  const grouped = accountIds.length ? await prisma.journalLine.groupBy({ by: ["accountId"], where: dimWhere, _sum: { debit: true, credit: true } }) : [];
  const actualByAccount = new Map<string, Prisma.Decimal>();
  for (const g of grouped) {
    const a = byId.get(g.accountId);
    const debit = D(g._sum.debit ?? 0), credit = D(g._sum.credit ?? 0);
    const actual = a?.normalBalance === "credit" ? sub(credit, debit) : sub(debit, credit);
    actualByAccount.set(g.accountId, actual);
  }

  // Aggregate budget by account (sum monthly/annual lines).
  const budgetByAccount = new Map<string, Prisma.Decimal>();
  for (const l of budget.lines) budgetByAccount.set(l.accountId, add(budgetByAccount.get(l.accountId) ?? ZERO, l.amount));

  const rows = [...budgetByAccount.entries()].map(([accountId, budgeted]) => {
    const a = byId.get(accountId);
    const actual = actualByAccount.get(accountId) ?? ZERO;
    const variance = sub(budgeted, actual); // budget − actual
    const pct = budgeted.isZero() ? null : Number(actual.div(budgeted).mul(100).toDecimalPlaces(1));
    return { accountId, code: a?.code ?? "", name: a?.name ?? "", type: a?.type ?? "", budget: budgeted.toString(), actual: actual.toString(), variance: variance.toString(), pctUsed: pct };
  }).sort((x, y) => x.code.localeCompare(y.code));

  const totalBudget = rows.reduce((s, r) => add(s, r.budget), ZERO);
  const totalActual = rows.reduce((s, r) => add(s, r.actual), ZERO);
  return { budget, from, to, rows, totalBudget: totalBudget.toString(), totalActual: totalActual.toString(), totalVariance: sub(totalBudget, totalActual).toString() };
}
