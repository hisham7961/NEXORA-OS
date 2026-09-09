"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, type ActionResult } from "@/lib/action";
import * as Cases from "@/domain/cases";

function buildInput(fd: FormData) {
  return {
    type: str(fd, "type"),
    priority: str(fd, "priority"),
    companyId: str(fd, "companyId"),
    brandId: str(fd, "brandId"),
    countryId: str(fd, "countryId"),
    storeId: str(fd, "storeId"),
    productId: str(fd, "productId"),
    orderRef: str(fd, "orderRef"),
    customerRef: str(fd, "customerRef"),
    description: str(fd, "description"),
    assignedToId: str(fd, "assignedToId"),
  };
}

export async function createCaseAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await Cases.createCase(ctx, buildInput(fd))).id }));
  if (res.ok) revalidatePath("/cases");
  return res;
}

export async function setCaseStatusAction(id: string, status: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Cases.setCaseStatus(ctx, id, status));
  if (res.ok) {
    revalidatePath("/cases");
    revalidatePath(`/cases/${id}`);
  }
  return res;
}

export async function assignCaseAction(id: string, assignedToId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Cases.updateCase(ctx, id, { assignedToId: assignedToId || undefined, status: assignedToId ? "assigned" : undefined }));
  if (res.ok) revalidatePath(`/cases/${id}`);
  return res;
}

export async function addCaseNoteAction(id: string, body: string, isInternal: boolean): Promise<ActionResult> {
  const res = await runAction((ctx) => Cases.addCaseNote(ctx, id, body, isInternal));
  if (res.ok) revalidatePath(`/cases/${id}`);
  return res;
}
