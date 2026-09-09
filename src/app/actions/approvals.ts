"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, strList, type ActionResult } from "@/lib/action";
import * as Approvals from "@/domain/approvals";

export async function createApprovalAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => {
    const r = await Approvals.createApprovalRequest(ctx, {
      title: str(fd, "title"),
      type: str(fd, "type") ?? "general",
      entityType: str(fd, "entityType"),
      entityId: str(fd, "entityId"),
      companyId: str(fd, "companyId"),
      brandId: str(fd, "brandId"),
      notes: str(fd, "notes"),
      approverIds: strList(fd, "approverIds"),
    });
    return { id: r.id };
  });
  if (res.ok) revalidatePath("/approvals");
  return res;
}

export async function decideApprovalAction(
  requestId: string,
  decision: "approved" | "rejected" | "changes",
  comment?: string,
): Promise<ActionResult> {
  const res = await runAction((ctx) => Approvals.decideApproval(ctx, requestId, decision, comment));
  if (res.ok) {
    revalidatePath("/approvals");
    revalidatePath(`/approvals/${requestId}`);
  }
  return res;
}

export async function cancelApprovalAction(requestId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Approvals.cancelApprovalRequest(ctx, requestId));
  if (res.ok) {
    revalidatePath("/approvals");
    revalidatePath(`/approvals/${requestId}`);
  }
  return res;
}
