import type { Prisma } from "@prisma/client";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/permissions/engine";
import { canFinance } from "./common";
import { profitAndLoss } from "./reports";
import { cashPosition } from "./bank";
import { D, ZERO, add, sub } from "@/lib/money";

/**
 * Financial Intelligence (§Increment G). Analytical P&L by any dimension (brand,
 * country, product, store, campaign, department) and a company financial overview —
 * the NEXORA advantage: real posted-ledger profitability sliced by the business's
 * own dimensions, never operational estimates (§50/§56). Posted lines only.
 */

const DIMENSIONS = {
  brand: "brandId", country: "countryId", product: "productId", store: "storeId", campaign: "campaignId", department: "departmentId",
} as const;
export type PnlDimension = keyof typeof DIMENSIONS;

function assertReport(principal: Principal, companyId: string): void {
  if (!canFinance(principal, "reports.financial", companyId) && !canFinance(principal, "accounting.view", companyId)) throw new ForbiddenError("reports.financial");
}

async function resolveNames(dimension: PnlDimension, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const where = { id: { in: ids } };
  const select = { id: true, name: true };
  let rows: { id: string; name: string }[] = [];
  switch (dimension) {
    case "brand": rows = await prisma.brand.findMany({ where, select }); break;
    case "country": rows = await prisma.country.findMany({ where, select }); break;
    case "product": rows = await prisma.product.findMany({ where, select }); break;
    case "store": rows = await prisma.store.findMany({ where, select }); break;
    case "campaign": rows = await prisma.campaign.findMany({ where, select }); break;
    case "department": rows = await prisma.department.findMany({ where, select }); break;
  }
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** P&L grouped by a dimension's values: revenue, COGS, gross profit, expenses, net. */
export async function dimensionPnl(principal: Principal, companyId: string, dimension: PnlDimension, opts: { from?: Date; to?: Date } = {}) {
  assertReport(principal, companyId);
  const field = DIMENSIONS[dimension];
  const where: Prisma.JournalLineWhereInput = {
    companyId, [field]: { not: null },
    entry: { status: "posted", ...(opts.from || opts.to ? { postingDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}) },
  };
  const grouped = await prisma.journalLine.groupBy({ by: [field, "accountId"], where, _sum: { debit: true, credit: true } });
  const accountIds = [...new Set(grouped.map((g) => g.accountId))];
  const accounts = await prisma.account.findMany({ where: { id: { in: accountIds } }, select: { id: true, type: true } });
  const typeById = new Map(accounts.map((a) => [a.id, a.type]));

  type Agg = { revenue: Prisma.Decimal; cogs: Prisma.Decimal; expense: Prisma.Decimal; otherIncome: Prisma.Decimal; otherExpense: Prisma.Decimal };
  const byDim = new Map<string, Agg>();
  for (const g of grouped) {
    const dimId = (g as Record<string, unknown>)[field] as string | null;
    if (!dimId) continue;
    const type = typeById.get(g.accountId);
    const debit = D(g._sum.debit ?? 0), credit = D(g._sum.credit ?? 0);
    const a = byDim.get(dimId) ?? { revenue: ZERO, cogs: ZERO, expense: ZERO, otherIncome: ZERO, otherExpense: ZERO };
    if (type === "revenue") a.revenue = add(a.revenue, sub(credit, debit));
    else if (type === "other_income") a.otherIncome = add(a.otherIncome, sub(credit, debit));
    else if (type === "cogs") a.cogs = add(a.cogs, sub(debit, credit));
    else if (type === "expense") a.expense = add(a.expense, sub(debit, credit));
    else if (type === "other_expense") a.otherExpense = add(a.otherExpense, sub(debit, credit));
    else continue;
    byDim.set(dimId, a);
  }
  const names = await resolveNames(dimension, [...byDim.keys()]);
  const rows = [...byDim.entries()].map(([id, a]) => {
    const grossProfit = sub(a.revenue, a.cogs);
    const netProfit = add(sub(sub(grossProfit, a.expense), a.otherExpense), a.otherIncome);
    const margin = a.revenue.isZero() ? null : Number(netProfit.div(a.revenue).mul(100).toDecimalPlaces(1));
    return { id, name: names.get(id) ?? id, revenue: a.revenue.toString(), cogs: a.cogs.toString(), grossProfit: grossProfit.toString(), expense: add(a.expense, a.otherExpense).toString(), netProfit: netProfit.toString(), margin };
  }).sort((x, y) => (D(y.netProfit).greaterThan(x.netProfit) ? 1 : -1));

  const totals = rows.reduce((t, r) => ({ revenue: add(t.revenue, r.revenue), grossProfit: add(t.grossProfit, r.grossProfit), netProfit: add(t.netProfit, r.netProfit) }), { revenue: ZERO, grossProfit: ZERO, netProfit: ZERO });
  return { dimension, from: opts.from ?? null, to: opts.to ?? null, rows, totals: { revenue: totals.revenue.toString(), grossProfit: totals.grossProfit.toString(), netProfit: totals.netProfit.toString() } };
}

/**
 * A single entity's posted-ledger financials across the accounting companies the
 * principal may see — the 360 financial integration (§60). Legal companies stay
 * separated: one row per company, plus a group total.
 */
export async function entityFinancials(principal: Principal, dimension: PnlDimension, id: string) {
  const field = DIMENSIONS[dimension];
  const { accountingCompanies } = await import("./access");
  const companies = await accountingCompanies(principal);
  const yr = new Date().getFullYear();
  const from = new Date(yr, 0, 1), to = new Date();
  const rows: { companyId: string; companyName: string; baseCurrency: string; revenue: string; grossProfit: string; netProfit: string }[] = [];
  let anyActivity = false;
  for (const c of companies) {
    const grouped = await prisma.journalLine.groupBy({ by: ["accountId"], where: { companyId: c.id, [field]: id, entry: { status: "posted", postingDate: { gte: from, lte: to } } }, _sum: { debit: true, credit: true } });
    if (grouped.length === 0) continue;
    anyActivity = true;
    const accountIds = grouped.map((g) => g.accountId);
    const accts = await prisma.account.findMany({ where: { id: { in: accountIds } }, select: { id: true, type: true } });
    const typeById = new Map(accts.map((a) => [a.id, a.type]));
    let revenue = ZERO, cogs = ZERO, expense = ZERO;
    for (const g of grouped) {
      const t = typeById.get(g.accountId); const debit = D(g._sum.debit ?? 0), credit = D(g._sum.credit ?? 0);
      if (t === "revenue" || t === "other_income") revenue = add(revenue, sub(credit, debit));
      else if (t === "cogs") cogs = add(cogs, sub(debit, credit));
      else if (t === "expense" || t === "other_expense") expense = add(expense, sub(debit, credit));
    }
    const grossProfit = sub(revenue, cogs);
    rows.push({ companyId: c.id, companyName: c.name, baseCurrency: c.baseCurrency, revenue: revenue.toString(), grossProfit: grossProfit.toString(), netProfit: sub(grossProfit, expense).toString() });
  }
  return { dimension, id, from, to, rows, hasActivity: anyActivity };
}

/** A management financial overview: headline P&L, cash, AR/AP outstanding, top brands. */
export async function companyFinancialOverview(principal: Principal, companyId: string) {
  assertReport(principal, companyId);
  const yr = new Date().getFullYear();
  const from = new Date(yr, 0, 1), to = new Date();
  const [pl, cash, arDue, apDue, brands] = await Promise.all([
    profitAndLoss(principal, { companyId, from, to }),
    cashPosition(principal, companyId, to),
    prisma.salesInvoice.aggregate({ where: { companyId, status: { in: ["issued", "partially_paid"] } }, _sum: { amountDue: true } }),
    prisma.supplierBill.aggregate({ where: { companyId, status: { in: ["open", "partially_paid"] } }, _sum: { amountDue: true } }),
    dimensionPnl(principal, companyId, "brand", { from, to }),
  ]);
  return {
    period: { from, to },
    revenue: pl.revenue, grossProfit: pl.grossProfit, netProfit: pl.netProfit, operatingProfit: pl.operatingProfit,
    cash: cash.baseTotal.toString(),
    arOutstanding: (arDue._sum.amountDue ?? D(0)).toString(),
    apOutstanding: (apDue._sum.amountDue ?? D(0)).toString(),
    topBrands: brands.rows.slice(0, 5),
  };
}
