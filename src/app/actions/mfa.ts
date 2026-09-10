"use server";

import { runAction, type ActionResult } from "@/lib/action";
import { beginMfaEnrollment, confirmMfaEnrollment, disableMfa } from "@/domain/mfa";

export async function beginMfaEnrollmentAction(): Promise<ActionResult<{ secret: string; otpauthUri: string }>> {
  return runAction((ctx) => beginMfaEnrollment(ctx));
}

export async function confirmMfaEnrollmentAction(code: string): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  return runAction((ctx) => confirmMfaEnrollment(ctx, code));
}

export async function disableMfaAction(code: string): Promise<ActionResult<void>> {
  return runAction((ctx) => disableMfa(ctx, code));
}
