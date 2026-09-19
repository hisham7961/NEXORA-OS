"use server";

import { runAction, str, type ActionResult } from "@/lib/action";
import { createExpense } from "@/domain/expenses";

/** File a new expense (audit DOM-06). Actor is derived from the session, not the form. */
export async function createExpenseAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async (ctx) => {
    const expense = await createExpense(ctx, {
      amount: str(fd, "amount"),
      currency: str(fd, "currency") ?? "KWD",
      date: str(fd, "date"),
      description: str(fd, "description"),
      categoryId: str(fd, "categoryId"),
      companyId: str(fd, "companyId"),
      brandId: str(fd, "brandId"),
      countryId: str(fd, "countryId"),
      departmentId: str(fd, "departmentId"),
      supplierId: str(fd, "supplierId"),
      storeId: str(fd, "storeId"),
      campaignId: str(fd, "campaignId"),
      taxAmount: str(fd, "taxAmount"),
    });
    return { id: expense.id };
  });
}
