"use server";

import { runAction, type ActionResult } from "@/lib/action";
import { revokeSession, revokeOtherSessions } from "@/domain/sessions";
import { getCurrentSessionId } from "@/lib/auth/session";

export async function revokeSessionAction(id: string): Promise<ActionResult<void>> {
  return runAction((ctx) => revokeSession(ctx, id));
}

export async function revokeOtherSessionsAction(): Promise<ActionResult<{ revoked: number }>> {
  const currentSessionId = await getCurrentSessionId();
  return runAction(async (ctx) => ({ revoked: await revokeOtherSessions(ctx, currentSessionId) }));
}
