"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { createSupplier, updateSupplier, setSupplierActive, archiveSupplier } from "@/domain/accounting/suppliers";
import { createBill, updateBill, postBill, voidBill, createSupplierCredit, postSupplierCredit, applySupplierCredit, postPayment, allocatePayment } from "@/domain/accounting/ap";
import { postExpense, setExpenseCategoryAccount } from "@/domain/accounting/expenses-gl";

// --- Suppliers -------------------------------------------------------------
export async function createSupplierAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await createSupplier(ctx, companyId, data)).id }));
  if (res.ok) revalidatePath("/accounting/suppliers");
  return res;
}
export async function updateSupplierAction(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  const res = await runAction((ctx) => updateSupplier(ctx, id, data));
  if (res.ok) revalidatePath("/accounting/suppliers");
  return res;
}
export async function setSupplierActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const res = await runAction((ctx) => setSupplierActive(ctx, id, isActive));
  if (res.ok) revalidatePath("/accounting/suppliers");
  return res;
}
export async function archiveSupplierAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => archiveSupplier(ctx, id));
  if (res.ok) revalidatePath("/accounting/suppliers");
  return res;
}

// --- Bills -----------------------------------------------------------------
export async function createBillAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await createBill(ctx, companyId, data)).id }));
  if (res.ok) revalidatePath("/accounting/bills");
  return res;
}
export async function updateBillAction(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  const res = await runAction((ctx) => updateBill(ctx, id, data));
  if (res.ok) { revalidatePath("/accounting/bills"); revalidatePath(`/accounting/bills/${id}`); }
  return res;
}
export async function postBillAction(id: string): Promise<ActionResult<{ billNumber: string | null }>> {
  const res = await runAction(async (ctx) => ({ billNumber: (await postBill(ctx, id)).billNumber }));
  if (res.ok) { revalidatePath("/accounting/bills"); revalidatePath(`/accounting/bills/${id}`); }
  return res;
}
export async function voidBillAction(id: string, reason: string): Promise<ActionResult> {
  const res = await runAction((ctx) => voidBill(ctx, id, reason));
  if (res.ok) { revalidatePath("/accounting/bills"); revalidatePath(`/accounting/bills/${id}`); }
  return res;
}

// --- Supplier credits ------------------------------------------------------
export async function createSupplierCreditAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await createSupplierCredit(ctx, companyId, data)).id }));
  if (res.ok) revalidatePath("/accounting/supplier-credits");
  return res;
}
export async function postSupplierCreditAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => postSupplierCredit(ctx, id));
  if (res.ok) { revalidatePath("/accounting/supplier-credits"); revalidatePath(`/accounting/supplier-credits/${id}`); }
  return res;
}
export async function applySupplierCreditAction(id: string, allocations: { billId: string; amount: number }[]): Promise<ActionResult> {
  const res = await runAction((ctx) => applySupplierCredit(ctx, id, allocations));
  if (res.ok) { revalidatePath("/accounting/supplier-credits"); revalidatePath(`/accounting/supplier-credits/${id}`); revalidatePath("/accounting/bills"); }
  return res;
}

// --- Supplier payments -----------------------------------------------------
export async function postPaymentAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult<{ id: string; paymentNumber: string | null }>> {
  const res = await runAction(async (ctx) => { const p = await postPayment(ctx, companyId, data); return { id: p.id, paymentNumber: p.paymentNumber }; });
  if (res.ok) { revalidatePath("/accounting/payments"); revalidatePath("/accounting/bills"); }
  return res;
}
export async function allocatePaymentAction(id: string, allocations: { billId: string; amount: number }[]): Promise<ActionResult> {
  const res = await runAction((ctx) => allocatePayment(ctx, id, allocations));
  if (res.ok) { revalidatePath("/accounting/payments"); revalidatePath(`/accounting/payments/${id}`); revalidatePath("/accounting/bills"); }
  return res;
}

// --- Expense posting -------------------------------------------------------
export async function postExpenseAction(id: string, opts?: { expenseAccountId?: string; paymentAccountId?: string }): Promise<ActionResult> {
  const res = await runAction((ctx) => postExpense(ctx, id, opts ?? {}));
  if (res.ok) revalidatePath("/expenses");
  return res;
}
export async function setExpenseCategoryAccountAction(categoryId: string, data: Record<string, unknown>): Promise<ActionResult> {
  const res = await runAction((ctx) => setExpenseCategoryAccount(ctx, categoryId, data));
  if (res.ok) revalidatePath("/expenses");
  return res;
}
