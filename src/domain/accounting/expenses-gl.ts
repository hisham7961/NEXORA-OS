import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { D, ZERO, add, gt, isZero } from "@/lib/money";
import { canFinance, requireSettings } from "./common";
import { resolveExchangeRate } from "./setup";
import { prepareForPost, writePostedEntry } from "./posting";

/**
 * Expense → GL bridge (§Increment D §55). An operational Expense record posts to the
 * ledger once approved: Dr Expense (category's mapped account) + Dr Input Tax / Cr
 * Bank|Cash (company-paid) or Cr Payable (supplier-billed). Posting requires the
 * expense be approved and the actor hold accounting.post in the company scope.
 */

/** Map an expense category to its default GL account + input-tax rate (§D config). */
export const categoryAccountSchema = z.object({
  defaultAccountId: z.string().nullable().optional(),
  taxRateId: z.string().nullable().optional(),
});

export async function setExpenseCategoryAccount(ctx: ActorContext, categoryId: string, raw: unknown) {
  const cat = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
  if (!cat) throw new ServiceError("not_found", "Category not found", 404);
  assertCan(ctx.principal, "accounting.manage", { companyId: cat.companyId ?? "" });
  const input = categoryAccountSchema.parse(raw);
  if (input.defaultAccountId) {
    const acct = await prisma.account.findUnique({ where: { id: input.defaultAccountId } });
    if (!acct || (cat.companyId && acct.companyId !== cat.companyId)) throw new ServiceError("bad_account", "Account must belong to the category's company.", 422);
  }
  const updated = await prisma.expenseCategory.update({ where: { id: categoryId }, data: { defaultAccountId: input.defaultAccountId ?? null, taxRateId: input.taxRateId ?? null } });
  await audit(ctx, { action: "expense_category.mapped", entityType: "ExpenseCategory", entityId: categoryId, summary: `${cat.name} → account`, companyId: cat.companyId });
  return updated;
}

/**
 * Post an approved expense to the ledger. Idempotent guard: an already-posted
 * expense cannot be posted again.
 */
export async function postExpense(ctx: ActorContext, expenseId: string, opts: { expenseAccountId?: string; paymentAccountId?: string } = {}) {
  const exp = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!exp || exp.archivedAt) throw new ServiceError("not_found", "Expense not found", 404);
  const companyId = exp.companyId;
  if (!companyId) throw new ServiceError("no_company", "Expense has no company and cannot be posted.", 422);
  assertCan(ctx.principal, "accounting.post", { companyId });
  if (exp.journalEntryId || exp.status === "posted" || exp.status === "paid") throw new ServiceError("already_posted", "Expense is already posted to the ledger.", 422);
  const elevated = canFinance(ctx.principal, "expenses.manage", companyId);
  if (exp.status !== "approved" && !elevated) throw new ServiceError("not_approved", "Only an approved expense can be posted.", 422);

  const settings = await requireSettings(companyId);
  const category = exp.categoryId ? await prisma.expenseCategory.findUnique({ where: { id: exp.categoryId } }) : null;
  const expenseAccountId = opts.expenseAccountId ?? category?.defaultAccountId ?? settings.suspenseAccountId;
  if (!expenseAccountId) throw new ServiceError("no_expense_account", "No expense account: map the category to a GL account.", 422);

  const net = D(exp.amount);
  const tax = D(exp.taxAmount ?? 0);
  const total = add(net, tax);
  if (isZero(total)) throw new ServiceError("empty", "Cannot post a zero-amount expense.", 422);
  const currency = exp.currency;
  const rate = currency === settings.baseCurrency ? 1 : await resolveExchangeRate(currency, settings.baseCurrency, exp.date);

  // Credit side: a linked supplier bills to Payable; otherwise company pays from cash/bank.
  const creditAccountId = exp.supplierId
    ? (settings.payableAccountId ?? null)
    : (opts.paymentAccountId ?? exp.paymentAccountId ?? settings.cashAccountId ?? settings.bankClearingAccountId ?? null);
  if (!creditAccountId) throw new ServiceError("no_credit_account", exp.supplierId ? "No payable account configured." : "No cash/bank account configured.", 422);

  const jl: Record<string, unknown>[] = [
    { accountId: expenseAccountId, debit: Number(net), credit: 0, brandId: exp.brandId ?? undefined, countryId: exp.countryId ?? undefined, departmentId: exp.departmentId ?? undefined, campaignId: exp.campaignId ?? undefined, storeId: exp.storeId ?? undefined, supplierId: exp.supplierId ?? undefined, description: exp.description ?? "Expense" },
  ];
  if (gt(tax, 0)) {
    const taxAcct = settings.inputTaxAccountId;
    if (!taxAcct) throw new ServiceError("no_tax_account", "No input tax account configured.", 422);
    jl.push({ accountId: taxAcct, debit: Number(tax), credit: 0, supplierId: exp.supplierId ?? undefined, description: "Input tax" });
  }
  jl.push({ accountId: creditAccountId, debit: 0, credit: Number(total), brandId: exp.brandId ?? undefined, countryId: exp.countryId ?? undefined, supplierId: exp.supplierId ?? undefined, description: exp.description ?? "Expense" });

  const journalRaw = { companyId, journalCode: "EJ", date: exp.date, currency, exchangeRate: rate === 1 ? undefined : rate, memo: `Expense: ${exp.description ?? category?.name ?? ""}`.trim(), sourceType: "Expense", sourceId: exp.id, lines: jl };
  const { input, prepared, postingDate, periodId } = await prepareForPost(ctx, journalRaw);

  const updated = await prisma.$transaction(async (tx) => {
    const entry = await writePostedEntry(tx, ctx, input, prepared, postingDate, periodId);
    return tx.expense.update({ where: { id: expenseId }, data: { status: "posted", journalEntryId: entry.id, postedById: ctx.principal.userId, postedAt: new Date() } });
  });
  await audit(ctx, { action: "expense.posted", entityType: "Expense", entityId: expenseId, summary: `Expense ${total} ${currency} posted`, companyId });
  return updated;
}
