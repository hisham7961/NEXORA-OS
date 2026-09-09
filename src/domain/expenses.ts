import { z } from "zod";
import type { Expense } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canAnywhere, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";

/** Expenses (§26). Amounts are gated by finance.view_values. */
export const expenseQuerySchema = listQuerySchema.extend({ status: z.string().optional(), brandId: z.string().optional() });
export type ExpenseQuery = z.infer<typeof expenseQuerySchema>;

export async function listExpenses(principal: Principal, query: ExpenseQuery): Promise<{ rows: Expense[]; total: number; showValues: boolean }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "expenses.view", DIMS_CBC, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ description: { contains: query.q } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: { date: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.expense.count({ where }),
  ]);
  return { rows, total, showValues: canAnywhere(principal, "finance.view_values") };
}
