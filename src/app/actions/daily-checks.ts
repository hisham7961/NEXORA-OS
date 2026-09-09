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
