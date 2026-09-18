import { z } from "zod";
import type { Expense } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canAnywhere, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { roundMoney, isZero, isNeg, ZERO } from "@/lib/money";
import { optionalString } from "@/lib/validation";

/** Expenses (§26). Amounts are gated by finance.view_values. */
export const expenseQuerySchema = listQuerySchema.extend({ status: z.string().optional(), brandId: z.string().optional() });
export type ExpenseQuery = z.infer<typeof expenseQuerySchema>;

export async function listExpenses(principal: Principal, query: ExpenseQuery): Promise<{ rows: Expense[]; total: number; showValues: boolean }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "expenses.view", DIMS_CBC, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ description: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: { date: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.expense.count({ where }),
  ]);
  return { rows, total, showValues: canAnywhere(principal, "finance.view_values") };
}

/** Expense categories for the create form (small master set; names are not sensitive). */
export async function listExpenseCategories(): Promise<{ id: string; name: string; companyId: string | null }[]> {
  return prisma.expenseCategory.findMany({ select: { id: true, name: true, companyId: true }, orderBy: { name: "asc" } });
}

const expenseDate = z.preprocess((v) => (v === "" || v == null ? undefined : new Date(String(v))), z.date());

export const expenseCreateSchema = z.object({
  amount: z.coerce.number(),
  currency: z.string().default("KWD"),
  date: expenseDate,
  description: optionalString,
  categoryId: optionalString,
  companyId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  departmentId: optionalString,
  supplierId: optionalString,
  storeId: optionalString,
  campaignId: optionalString,
  taxAmount: z.coerce.number().optional(),
});

/**
 * File an expense (§26 — audit DOM-06). Expenses list/read existed but there was
 * no way to enter one; this is the claimant's submit path. Fail-closed on the NEW
 * record's create scope (§69), amount rounded to its currency, filed as `pending`
 * for approval with the actor stamped as submitter (never client input), then audited.
 * GL posting stays a separate, approval-gated step (`postExpense`).
 */
export async function createExpense(ctx: ActorContext, raw: unknown): Promise<Expense> {
  const input = expenseCreateSchema.parse(raw);
  const scope = { companyId: input.companyId ?? null, brandId: input.brandId ?? null, countryId: input.countryId ?? null };
  assertCan(ctx.principal, "expenses.create", scope);

  // A category scoped to a company must match the expense's company (mirrors postExpense's account guard).
  if (input.categoryId && input.companyId) {
    const cat = await prisma.expenseCategory.findUnique({ where: { id: input.categoryId } });
    if (cat?.companyId && cat.companyId !== input.companyId) throw new ServiceError("bad_category", "Category belongs to a different company.", 422);
  }

  const currency = (input.currency || "KWD").toUpperCase();
  const amount = roundMoney(input.amount, currency);
  if (isZero(amount) || isNeg(amount)) throw new ServiceError("bad_amount", "Amount must be greater than zero.", 422);
  const taxAmount = input.taxAmount != null ? roundMoney(input.taxAmount, currency) : ZERO;
  if (isNeg(taxAmount)) throw new ServiceError("bad_tax", "Tax cannot be negative.", 422);

  const expense = await prisma.expense.create({
    data: {
      ...scope,
      departmentId: input.departmentId ?? null,
      categoryId: input.categoryId ?? null,
      storeId: input.storeId ?? null,
      campaignId: input.campaignId ?? null,
      supplierId: input.supplierId ?? null,
      amount,
      taxAmount,
      currency,
      date: input.date,
      description: input.description ?? null,
      status: "pending",
      submittedById: ctx.principal.userId,
    },
  });
  await audit(ctx, { action: "expense.created", entityType: "Expense", entityId: expense.id, summary: `Expense filed: ${expense.description ?? amount.toString()} ${currency}`, brandId: expense.brandId, companyId: expense.companyId });
  return expense;
}
