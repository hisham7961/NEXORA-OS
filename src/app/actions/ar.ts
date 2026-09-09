"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { createCustomer, updateCustomer, setCustomerActive, archiveCustomer } from "@/domain/accounting/customers";
import { createInvoice, updateInvoice, issueInvoice, voidInvoice, createCreditNote, issueCreditNote, applyCreditNote, postReceipt, allocateReceipt } from "@/domain/accounting/ar";

// --- Customers -------------------------------------------------------------
export async function createCustomerAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await createCustomer(ctx, companyId, data)).id }));
  if (res.ok) revalidatePath("/accounting/customers");
  return res;
}
export async function updateCustomerAction(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  const res = await runAction((ctx) => updateCustomer(ctx, id, data));
  if (res.ok) revalidatePath("/accounting/customers");
  return res;
}
export async function setCustomerActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const res = await runAction((ctx) => setCustomerActive(ctx, id, isActive));
  if (res.ok) revalidatePath("/accounting/customers");
  return res;
}
export async function archiveCustomerAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => archiveCustomer(ctx, id));
  if (res.ok) revalidatePath("/accounting/customers");
  return res;
}

// --- Invoices --------------------------------------------------------------
export async function createInvoiceAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await createInvoice(ctx, companyId, data)).id }));
  if (res.ok) revalidatePath("/accounting/invoices");
  return res;
}
export async function updateInvoiceAction(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  const res = await runAction((ctx) => updateInvoice(ctx, id, data));
  if (res.ok) { revalidatePath("/accounting/invoices"); revalidatePath(`/accounting/invoices/${id}`); }
  return res;
}
export async function issueInvoiceAction(id: string): Promise<ActionResult<{ invoiceNumber: string | null }>> {
  const res = await runAction(async (ctx) => ({ invoiceNumber: (await issueInvoice(ctx, id)).invoiceNumber }));
  if (res.ok) { revalidatePath("/accounting/invoices"); revalidatePath(`/accounting/invoices/${id}`); }
  return res;
}
export async function voidInvoiceAction(id: string, reason: string): Promise<ActionResult> {
  const res = await runAction((ctx) => voidInvoice(ctx, id, reason));
  if (res.ok) { revalidatePath("/accounting/invoices"); revalidatePath(`/accounting/invoices/${id}`); }
  return res;
}

// --- Credit notes ----------------------------------------------------------
export async function createCreditNoteAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await createCreditNote(ctx, companyId, data)).id }));
  if (res.ok) revalidatePath("/accounting/credit-notes");
  return res;
}
export async function issueCreditNoteAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => issueCreditNote(ctx, id));
  if (res.ok) { revalidatePath("/accounting/credit-notes"); revalidatePath(`/accounting/credit-notes/${id}`); }
  return res;
}
export async function applyCreditNoteAction(id: string, allocations: { invoiceId: string; amount: number }[]): Promise<ActionResult> {
  const res = await runAction((ctx) => applyCreditNote(ctx, id, allocations));
  if (res.ok) { revalidatePath("/accounting/credit-notes"); revalidatePath(`/accounting/credit-notes/${id}`); revalidatePath("/accounting/invoices"); }
  return res;
}

// --- Receipts --------------------------------------------------------------
export async function postReceiptAction(companyId: string, data: Record<string, unknown>): Promise<ActionResult<{ id: string; receiptNumber: string | null }>> {
  const res = await runAction(async (ctx) => { const r = await postReceipt(ctx, companyId, data); return { id: r.id, receiptNumber: r.receiptNumber }; });
  if (res.ok) { revalidatePath("/accounting/receipts"); revalidatePath("/accounting/invoices"); }
  return res;
}
export async function allocateReceiptAction(id: string, allocations: { invoiceId: string; amount: number }[]): Promise<ActionResult> {
  const res = await runAction((ctx) => allocateReceipt(ctx, id, allocations));
  if (res.ok) { revalidatePath("/accounting/receipts"); revalidatePath(`/accounting/receipts/${id}`); revalidatePath("/accounting/invoices"); }
  return res;
}
