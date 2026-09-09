import { cache } from "react";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { loadPrincipal } from "@/lib/permissions/load";
import { UnauthorizedError, type Principal } from "@/lib/permissions/engine";
import { getSessionUserId } from "./session";

/**
 * Per-request memoized current user + principal. `cache()` dedupes the DB work
 * across a single server render / request so the sidebar, page and API can all
 * ask "who am I and what can I do" without repeated queries.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.archivedAt || user.status !== "active") return null;
  return user;
});

export const getPrincipal = cache(async (): Promise<Principal | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return loadPrincipal(userId);
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requirePrincipal(): Promise<Principal> {
  const principal = await getPrincipal();
  if (!principal) throw new UnauthorizedError();
  return principal;
}
