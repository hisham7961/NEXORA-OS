"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { assertCan } from "@/domain/mutation";
import { jobByName } from "@/lib/jobs/registry";
import { runJobNow } from "@/lib/jobs/scheduler";
import { ServiceError } from "@/lib/api/handler";

/** Manually trigger (or retry) a scheduled job from the Admin Operations Center (§10). */
export async function runJobAction(name: string): Promise<ActionResult<{ ok: boolean; durationMs: number; error?: string }>> {
  const res = await runAction(async (ctx) => {
    const def = jobByName(name);
    if (!def) throw new ServiceError("unknown_job", "Unknown job", 404);
    assertCan(ctx.principal, def.permission);
    const r = await runJobNow(name, ctx.principal.userId);
    if (!r.ok) throw new ServiceError("job_failed", r.error ?? "Job failed", 422);
    return { ok: r.ok, durationMs: r.durationMs, error: r.error };
  });
  if (res.ok) revalidatePath("/admin/system");
  return res;
}
