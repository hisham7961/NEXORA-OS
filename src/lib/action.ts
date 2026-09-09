import "server-only";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { getPrincipal } from "@/lib/auth/current-user";
import { UnauthorizedError, ForbiddenError, type Principal } from "@/lib/permissions/engine";
import { ServiceError } from "@/lib/api/handler";

/**
 * Server-action foundation (Phase 2, Part F). Every mutating server action runs
 * through `runAction`, which resolves the actor context, maps errors to a uniform
 * ActionResult (consumed by <ActionForm/>), and never leaks stack traces.
 */
export interface ActorContext {
  principal: Principal;
  ip: string | null;
  userAgent: string | null;
}

export async function actorContext(): Promise<ActorContext> {
  const principal = await getPrincipal();
  if (!principal) throw new UnauthorizedError();
  const h = await headers();
  return {
    principal,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
}

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function runAction<T>(fn: (ctx: ActorContext) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const ctx = await actorContext();
    const data = await fn(ctx);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ZodError) {
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: e.flatten().fieldErrors as Record<string, string[]> };
    }
    if (e instanceof ForbiddenError) return { ok: false, error: "You don't have permission to do that in this scope." };
    if (e instanceof UnauthorizedError) return { ok: false, error: "Your session expired — please sign in again." };
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    console.error("[action] unhandled error", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Coerce a FormData value to a trimmed string or undefined. */
export function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

export function strList(fd: FormData, key: string): string[] {
  return fd.getAll(key).map((v) => String(v).trim()).filter(Boolean);
}
