"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { createBankAccount, updateBankAccount, setBankAccountActive, createTransfer, createReconciliation, setLineReconciled, completeReconciliation } from "@/domain/accounting/bank";

export async function createBankAccountAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await createBankAccount(ctx, companyId, data)).id }));
  if (res.ok) revalidatePath("/accounting/bank");
  return res;
}
export async function updateBankAccountAction(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  const res = await runAction((ctx) => updateBankAccount(ctx, id, data));
  if (res.ok) revalidatePath("/accounting/bank");
  return res;
}
export async function setBankAccountActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const res = await runAction((ctx) => setBankAccountActive(ctx, id, isActive));
  if (res.ok) revalidatePath("/accounting/bank");
  return res;
}
export async function createTransferAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult<{ transferNumber: string | null }>> {
  const res = await runAction(async (ctx) => ({ transferNumber: (await createTransfer(ctx, companyId, data)).transferNumber }));
  if (res.ok) revalidatePath("/accounting/bank");
  return res;
}
export async function createReconciliationAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await createReconciliation(ctx, companyId, data)).id }));
  if (res.ok) revalidatePath("/accounting/bank");
  return res;
}
export async function setLineReconciledAction(reconciliationId: string, journalLineId: string, cleared: boolean): Promise<ActionResult<{ clearedBalance: string }>> {
  const res = await runAction((ctx) => setLineReconciled(ctx, reconciliationId, journalLineId, cleared));
  if (res.ok) revalidatePath(`/accounting/bank/reconcile/${reconciliationId}`);
  return res;
}
export async function completeReconciliationAction(id: string, force?: boolean): Promise<ActionResult> {
  const res = await runAction((ctx) => completeReconciliation(ctx, id, { force }));
  if (res.ok) { revalidatePath("/accounting/bank"); revalidatePath(`/accounting/bank/reconcile/${id}`); }
  return res;
}
