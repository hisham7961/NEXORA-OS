"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { createBudget, updateBudget, setBudgetStatus } from "@/domain/accounting/budgets";

export async function createBudgetAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await createBudget(ctx, companyId, data)).id }));
  if (res.ok) revalidatePath("/accounting/budgets");
  return res;
}
export async function updateBudgetAction(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  const res = await runAction((ctx) => updateBudget(ctx, id, data));
  if (res.ok) { revalidatePath("/accounting/budgets"); revalidatePath(`/accounting/budgets/${id}`); }
  return res;
}
export async function setBudgetStatusAction(id: string, status: "draft" | "active" | "archived"): Promise<ActionResult> {
  const res = await runAction((ctx) => setBudgetStatus(ctx, id, status));
  if (res.ok) { revalidatePath("/accounting/budgets"); revalidatePath(`/accounting/budgets/${id}`); }
  return res;
}
