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
  periodicity: z.enum(["annual", "quarterly", "monthly"]).optional(),
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
      periodicity: input.periodicity ?? "annual",
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
        periodicity: input.periodicity ?? b.periodicity,
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

/**
 * Periodized Budget vs Actual (§Phase4-3): per account × 12 fiscal months, with a
 * YTD roll-up. Monthly budget comes from lines' `periodMonth`; an un-periodized
 * (annual) line is spread evenly across the year. Actuals come ONLY from posted GL,
 * bucketed by the month index within the budget's fiscal year — never duplicated
 * into budget tables.
 */
export async function budgetVsActualMonthly(principal: Principal, budgetId: string) {
  const budget = await prisma.budget.findUnique({ where: { id: budgetId }, include: { lines: true } });
  if (!budget) throw new ServiceError("not_found", "Budget not found", 404);
  assertCan(principal, "budgets.view", { companyId: budget.companyId ?? "" });

  const fy = budget.fiscalYearId ? await prisma.fiscalYear.findUnique({ where: { id: budget.fiscalYearId } }) : null;
  const from = budget.periodStart ?? fy?.startDate ?? new Date(new Date().getFullYear(), 0, 1);
  const to = budget.periodEnd ?? fy?.endDate ?? new Date(new Date().getFullYear(), 11, 31);
  const fyStartMonth = from.getMonth(); // 0-based calendar month the fiscal year opens on
  // Map a posting date to a 1..12 fiscal-month index.
  const fiscalMonth = (d: Date) => (((d.getFullYear() - from.getFullYear()) * 12 + d.getMonth() - fyStartMonth) % 12 + 12) % 12 + 1;

  const accountIds = [...new Set(budget.lines.map((l) => l.accountId))];
  const accounts = await prisma.account.findMany({ where: { id: { in: accountIds } }, select: { id: true, code: true, name: true, type: true, normalBalance: true } });
  const byId = new Map(accounts.map((a) => [a.id, a]));

  // Budget per account per fiscal month (1..12); month 0 marker = annual line spread evenly.
  const budgetMatrix = new Map<string, Prisma.Decimal[]>(); // 12-slot arrays
  for (const id of accountIds) budgetMatrix.set(id, Array(12).fill(ZERO));
  for (const l of budget.lines) {
    const arr = budgetMatrix.get(l.accountId)!;
    if (l.periodMonth && l.periodMonth >= 1 && l.periodMonth <= 12) arr[l.periodMonth - 1] = add(arr[l.periodMonth - 1], l.amount);
    else { const per = D(l.amount).div(12); for (let m = 0; m < 12; m++) arr[m] = add(arr[m], per); }
  }

  // Actuals: posted lines on these accounts within the FY, bucketed by fiscal month.
  const lines = accountIds.length ? await prisma.journalLine.findMany({
    where: {
      companyId: budget.companyId ?? undefined, accountId: { in: accountIds },
      entry: { status: "posted", postingDate: { gte: from, lte: to } },
      ...(budget.brandId ? { brandId: budget.brandId } : {}), ...(budget.countryId ? { countryId: budget.countryId } : {}),
      ...(budget.departmentId ? { departmentId: budget.departmentId } : {}), ...(budget.campaignId ? { campaignId: budget.campaignId } : {}),
    },
    select: { accountId: true, debit: true, credit: true, entry: { select: { postingDate: true } } },
  }) : [];
  const actualMatrix = new Map<string, Prisma.Decimal[]>();
  for (const id of accountIds) actualMatrix.set(id, Array(12).fill(ZERO));
  for (const l of lines) {
    const a = byId.get(l.accountId); if (!a) continue;
    const signed = a.normalBalance === "credit" ? sub(D(l.credit), D(l.debit)) : sub(D(l.debit), D(l.credit));
    const m = fiscalMonth(l.entry.postingDate ?? from) - 1;
    const arr = actualMatrix.get(l.accountId)!;
    arr[m] = add(arr[m], signed);
  }

  const nowMonth = fiscalMonth(new Date()); // for YTD cut-off within this FY
  const rows = accountIds.map((id) => {
    const a = byId.get(id);
    const bud = budgetMatrix.get(id)!, act = actualMatrix.get(id)!;
    const months = bud.map((bv, m) => ({ month: m + 1, budget: bv.toString(), actual: act[m].toString(), variance: sub(bv, act[m]).toString() }));
    const ytdBudget = bud.slice(0, nowMonth).reduce((s, v) => add(s, v), ZERO);
    const ytdActual = act.slice(0, nowMonth).reduce((s, v) => add(s, v), ZERO);
    const fullBudget = bud.reduce((s, v) => add(s, v), ZERO);
    const fullActual = act.reduce((s, v) => add(s, v), ZERO);
    return { accountId: id, code: a?.code ?? "", name: a?.name ?? "", months, fullBudget: fullBudget.toString(), fullActual: fullActual.toString(), ytdBudget: ytdBudget.toString(), ytdActual: ytdActual.toString(), ytdVariance: sub(ytdBudget, ytdActual).toString(), pctUsed: fullBudget.isZero() ? null : Number(fullActual.div(fullBudget).mul(100).toDecimalPlaces(1)) };
  }).sort((x, y) => x.code.localeCompare(y.code));

  return { budget, from, to, currentMonth: nowMonth, rows };
}
