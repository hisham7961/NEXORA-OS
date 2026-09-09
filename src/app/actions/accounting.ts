"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { initializeCompanyAccounting } from "@/domain/accounting/bootstrap";
import { upsertAccountingSettings } from "@/domain/accounting/settings";
import { createAccount, updateAccount, setAccountActive, archiveAccount } from "@/domain/accounting/accounts";
import { createFiscalYear, setPeriodStatus } from "@/domain/accounting/fiscal";
import { createJournal } from "@/domain/accounting/setup";
import { postJournalEntry, reverseEntry } from "@/domain/accounting/posting";

export async function setupAccountingAction(companyId: string, baseCurrency?: string): Promise<ActionResult> {
  const res = await runAction((ctx) => initializeCompanyAccounting(ctx, companyId, { baseCurrency }));
  if (res.ok) revalidatePath("/accounting");
  return res;
}
export async function saveSettingsAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult> {
  const res = await runAction((ctx) => upsertAccountingSettings(ctx, companyId, data));
  if (res.ok) revalidatePath("/accounting");
  return res;
}
export async function createAccountAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await createAccount(ctx, companyId, data)).id }));
  if (res.ok) revalidatePath("/accounting/accounts");
  return res;
}
export async function updateAccountAction(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  const res = await runAction((ctx) => updateAccount(ctx, id, data));
  if (res.ok) revalidatePath("/accounting/accounts");
  return res;
}
export async function setAccountActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const res = await runAction((ctx) => setAccountActive(ctx, id, isActive));
  if (res.ok) revalidatePath("/accounting/accounts");
  return res;
}
export async function archiveAccountAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => archiveAccount(ctx, id));
  if (res.ok) revalidatePath("/accounting/accounts");
  return res;
}
export async function createFiscalYearAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult> {
  const res = await runAction((ctx) => createFiscalYear(ctx, companyId, data));
  if (res.ok) revalidatePath("/accounting");
  return res;
}
export async function setPeriodStatusAction(periodId: string, status: string, note?: string): Promise<ActionResult> {
  const res = await runAction((ctx) => setPeriodStatus(ctx, periodId, status as never, note));
  if (res.ok) revalidatePath("/accounting");
  return res;
}
export async function createJournalAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult> {
  const res = await runAction((ctx) => createJournal(ctx, companyId, data));
  if (res.ok) revalidatePath("/accounting");
  return res;
}
export async function postJournalAction(data: Record<string, unknown>): Promise<ActionResult<{ id: string; journalNumber: string | null }>> {
  const res = await runAction(async (ctx) => { const e = await postJournalEntry(ctx, data); return { id: e.id, journalNumber: e.journalNumber }; });
  if (res.ok) revalidatePath("/accounting/journal");
  return res;
}
export async function reverseEntryAction(id: string, reason: string): Promise<ActionResult> {
  const res = await runAction((ctx) => reverseEntry(ctx, id, { reason }));
  if (res.ok) revalidatePath("/accounting/journal");
  return res;
}
