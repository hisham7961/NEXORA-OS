"use server";

import { runAction, type ActionResult } from "@/lib/action";
import { createApiToken, revokeApiToken } from "@/domain/api-tokens";

/**
 * Create a personal API token for the caller. The raw token is returned ONCE and
 * is unrecoverable afterward — the UI must surface it immediately.
 */
export async function createApiTokenAction(input: { name: string; readOnly?: boolean; expiresInDays?: number }): Promise<ActionResult<{ id: string; token: string; name: string }>> {
  return runAction((ctx) => createApiToken(ctx, input));
}

export async function revokeApiTokenAction(id: string): Promise<ActionResult<void>> {
  return runAction((ctx) => revokeApiToken(ctx, id));
}
