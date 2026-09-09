"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import * as DC from "@/domain/daily-checks";

export async function completeChecklistItemAction(
  instanceId: string,
  itemId: string,
  done: boolean,
  note?: string,
  link?: string,
): Promise<ActionResult> {
  const res = await runAction((ctx) => DC.completeChecklistItem(ctx, instanceId, itemId, { done, note, link }));
  if (res.ok) revalidatePath(`/daily-checks/${instanceId}`);
  return res;
}

export async function addChecklistEvidenceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const instanceId = String(fd.get("instanceId"));
  const itemId = String(fd.get("itemId"));
  const picked = fd.get("file");
  if (!picked || typeof picked === "string") return { ok: false, error: "Please choose an evidence file." };
  const blob = picked as unknown as File;
  const body = Buffer.from(await blob.arrayBuffer());
  const res = await runAction((ctx) => DC.addChecklistItemEvidence(ctx, instanceId, itemId, { filename: blob.name, body, mimeType: blob.type || "application/octet-stream" }));
  if (res.ok) revalidatePath(`/daily-checks/${instanceId}`);
  return res;
}

export async function submitChecklistInstanceAction(instanceId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => DC.submitChecklistInstance(ctx, instanceId));
  if (res.ok) {
    revalidatePath(`/daily-checks/${instanceId}`);
    revalidatePath("/daily-checks");
  }
  return res;
}

export async function verifyChecklistInstanceAction(instanceId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => DC.verifyChecklistInstance(ctx, instanceId));
  if (res.ok) {
    revalidatePath(`/daily-checks/${instanceId}`);
    revalidatePath("/daily-checks");
  }
  return res;
}

export async function runDailyGeneratorAction(): Promise<ActionResult<{ created: number; skipped: number }>> {
  const res = await runAction(async (ctx) => {
    if (!canAnywhere(ctx.principal, "daily_checks.manage")) throw new ForbiddenError("daily_checks.manage");
    return DC.generateDailyChecks(ctx.principal.userId);
  });
  if (res.ok) revalidatePath("/daily-checks");
  return res;
}
