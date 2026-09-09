import { z } from "zod";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/permissions/engine";
import { canFinance } from "./common";
import { D, add, sub } from "@/lib/money";

/**
 * Financial reports (§53–57) — derived ONLY from POSTED ledger lines (§18/§104).
 * Company-scoped and gated by reports.financial. Dimension filters power the
 * NEXORA analytical P&L (by brand/country/product/store/campaign/department).
 */
export const glFilterSchema = z.object({
  companyId: z.string().min(1),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  accountId: z.string().optional(),
  brandId: z.string().optional(),
  countryId: z.string().optional(),
  productId: z.string().optional(),
  storeId: z.string().optional(),
  campaignId: z.string().optional(),
  departmentId: z.string().optional(),
  costCenterId: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(500).default(100),
});
export type GLFilter = z.infer<typeof glFilterSchema>;

function assertReport(principal: Principal, companyId: string): void {
  if (!canFinance(principal, "reports.financial", companyId) && !canFinance(principal, "accounting.view", companyId)) {
    throw new ForbiddenError("reports.financial");
  }
}

function dimWhere(f: GLFilter): Record<string, unknown> {
  const w: Record<string, unknown> = {};
  for (const k of ["accountId", "brandId", "countryId", "productId", "storeId", "campaignId", "departmentId", "costCenterId"] as const) {
    if (f[k]) w[k] = f[k];
  }
  return w;
}

/** General Ledger — posted lines with filters + pagination + running total. */
export async function generalLedger(principal: Principal, raw: unknown) {
  const f = glFilterSchema.parse(raw);
  assertReport(principal, f.companyId);
  const where = {
    companyId: f.companyId,
    entry: { status: "posted" as const, ...(f.from || f.to ? { postingDate: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}) },
    ...dimWhere(f),
  };
  const [rows, total] = await Promise.all([
    prisma.journalLine.findMany({ where, include: { entry: { select: { journalNumber: true, postingDate: true, date: true, memo: true, sourceType: true, sourceId: true } }, account: { select: { code: true, name: true } } }, orderBy: [{ entry: { postingDate: "asc" } }, { lineNo: "asc" }], skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
    prisma.journalLine.count({ where }),
  ]);
  return { rows, total, page: f.page, pageSize: f.pageSize };
}

/**
 * Trial Balance — per-account debit/credit totals from posted lines, as of a date.
 * The report itself asserts total debits == total credits (§55/§101).
 */
export async function trialBalance(principal: Principal, companyId: string, asOf?: Date) {
  assertReport(principal, companyId);
  const grouped = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: { companyId, entry: { status: "posted", ...(asOf ? { postingDate: { lte: asOf } } : {}) } },
    _sum: { debit: true, credit: true },
  });
  const accounts = await prisma.account.findMany({ where: { companyId }, select: { id: true, code: true, name: true, type: true, normalBalance: true } });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  let totalDebit = D(0), totalCredit = D(0);
  const rows = grouped.map((g) => {
    const a = byId.get(g.accountId)!;
    const debit = D(g._sum.debit ?? 0), credit = D(g._sum.credit ?? 0);
    const net = sub(debit, credit); // + = debit balance
    totalDebit = add(totalDebit, net.greaterThan(0) ? net : 0);
    totalCredit = add(totalCredit, net.lessThan(0) ? net.abs() : 0);
    return { accountId: g.accountId, code: a.code, name: a.name, type: a.type, debit: net.greaterThan(0) ? net.toString() : "0", credit: net.lessThan(0) ? net.abs().toString() : "0" };
  }).sort((x, y) => x.code.localeCompare(y.code));
  return { rows, totalDebit: totalDebit.toString(), totalCredit: totalCredit.toString(), balanced: totalDebit.equals(totalCredit) };
}

/**
 * Profit & Loss — revenue/COGS/expense account groups netted over a date range,
 * optionally sliced by any analytical dimension (the NEXORA advantage §50/§56).
 */
export async function profitAndLoss(principal: Principal, raw: unknown) {
  const f = glFilterSchema.parse(raw);
  assertReport(principal, f.companyId);
  const grouped = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: { companyId: f.companyId, entry: { status: "posted", ...(f.from || f.to ? { postingDate: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}) }, ...dimWhere(f) },
    _sum: { debit: true, credit: true },
  });
  const accounts = await prisma.account.findMany({ where: { companyId: f.companyId }, select: { id: true, code: true, name: true, type: true } });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const section = { revenue: D(0), cogs: D(0), expense: D(0), otherIncome: D(0), otherExpense: D(0) };
  const lines: { code: string; name: string; type: string; amount: string }[] = [];
  for (const g of grouped) {
    const a = byId.get(g.accountId); if (!a) continue;
    const debit = D(g._sum.debit ?? 0), credit = D(g._sum.credit ?? 0);
    // Revenue/income: credit-normal → amount = credit - debit. Expense/COGS: debit-normal → debit - credit.
    let amount = D(0);
    if (a.type === "revenue" || a.type === "other_income") { amount = sub(credit, debit); section[a.type === "revenue" ? "revenue" : "otherIncome"] = add(section[a.type === "revenue" ? "revenue" : "otherIncome"], amount); }
    else if (a.type === "cogs") { amount = sub(debit, credit); section.cogs = add(section.cogs, amount); }
    else if (a.type === "expense") { amount = sub(debit, credit); section.expense = add(section.expense, amount); }
    else if (a.type === "other_expense") { amount = sub(debit, credit); section.otherExpense = add(section.otherExpense, amount); }
    else continue;
    lines.push({ code: a.code, name: a.name, type: a.type, amount: amount.toString() });
  }
  const grossProfit = sub(section.revenue, section.cogs);
  const operatingProfit = sub(grossProfit, section.expense);
  const netProfit = add(sub(operatingProfit, section.otherExpense), section.otherIncome);
  return {
    lines: lines.sort((a, b) => a.code.localeCompare(b.code)),
    revenue: section.revenue.toString(), cogs: section.cogs.toString(), grossProfit: grossProfit.toString(),
    operatingExpense: section.expense.toString(), operatingProfit: operatingProfit.toString(),
    otherIncome: section.otherIncome.toString(), otherExpense: section.otherExpense.toString(), netProfit: netProfit.toString(),
  };
}

/**
 * Balance Sheet — asset/liability/equity balances as of a date, with current-period
 * earnings folded into equity so Assets = Liabilities + Equity (§57).
 */
export async function balanceSheet(principal: Principal, companyId: string, asOf?: Date) {
  assertReport(principal, companyId);
  const grouped = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: { companyId, entry: { status: "posted", ...(asOf ? { postingDate: { lte: asOf } } : {}) } },
    _sum: { debit: true, credit: true },
  });
  const accounts = await prisma.account.findMany({ where: { companyId }, select: { id: true, code: true, name: true, type: true } });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  let assets = D(0), liabilities = D(0), equity = D(0), earnings = D(0);
  const rows: { code: string; name: string; section: string; amount: string }[] = [];
  for (const g of grouped) {
    const a = byId.get(g.accountId); if (!a) continue;
    const debit = D(g._sum.debit ?? 0), credit = D(g._sum.credit ?? 0);
    if (a.type === "asset") { const amt = sub(debit, credit); assets = add(assets, amt); rows.push({ code: a.code, name: a.name, section: "asset", amount: amt.toString() }); }
    else if (a.type === "liability") { const amt = sub(credit, debit); liabilities = add(liabilities, amt); rows.push({ code: a.code, name: a.name, section: "liability", amount: amt.toString() }); }
    else if (a.type === "equity") { const amt = sub(credit, debit); equity = add(equity, amt); rows.push({ code: a.code, name: a.name, section: "equity", amount: amt.toString() }); }
    else if (a.type === "revenue" || a.type === "other_income") earnings = add(earnings, sub(credit, debit));
    else earnings = sub(earnings, sub(debit, credit)); // cogs/expense reduce earnings
  }
  const equityWithEarnings = add(equity, earnings);
  return {
    rows: rows.sort((a, b) => a.code.localeCompare(b.code)),
    assets: assets.toString(), liabilities: liabilities.toString(), equity: equity.toString(),
    currentEarnings: earnings.toString(), totalEquity: equityWithEarnings.toString(),
    balanced: assets.equals(add(liabilities, equityWithEarnings)),
  };
}
