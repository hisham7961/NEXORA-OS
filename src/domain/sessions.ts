import { prisma } from "@/lib/db";
import type { Principal } from "@/lib/permissions/engine";
import { audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";

/**
 * Session management (§28-29). A user can see every device where their account is
 * signed in and revoke any of them — the core "someone else is logged in as me"
 * control. Sessions are personal, so the only authorization is ownership. Revoking
 * a session sets revokedAt; getSessionUserId() then rejects its cookie on the next
 * request, so access is cut without waiting for expiry.
 */
export interface SessionView {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastActiveAt: Date | null;
  expiresAt: Date;
  current: boolean;
}

/** The caller's live sessions (not revoked, not expired), newest activity first. */
export async function listMySessions(principal: Principal, currentSessionId: string | null): Promise<SessionView[]> {
  const rows = await prisma.session.findMany({
    where: { userId: principal.userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: [{ lastActiveAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, userAgent: true, ip: true, createdAt: true, lastActiveAt: true, expiresAt: true },
  });
  return rows.map((s) => ({ ...s, current: s.id === currentSessionId }));
}

/** Revoke one of the caller's sessions (may be the current one — that logs it out). */
export async function revokeSession(ctx: ActorContext, id: string): Promise<void> {
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session || session.userId !== ctx.principal.userId) throw new ServiceError("not_found", "Session not found", 404);
  if (session.revokedAt) return;
  await prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });
  await audit(ctx, { action: "session.revoked", entityType: "Session", entityId: id, summary: "Revoked a session" });
}

/** Revoke every session except the current one ("sign out everywhere else"). */
export async function revokeOtherSessions(ctx: ActorContext, currentSessionId: string | null): Promise<number> {
  const res = await prisma.session.updateMany({
    where: { userId: ctx.principal.userId, revokedAt: null, ...(currentSessionId ? { id: { not: currentSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
  if (res.count > 0) await audit(ctx, { action: "session.revoked_others", entityType: "Session", summary: `Revoked ${res.count} other session(s)` });
  return res.count;
}

/** Purge sessions long past expiry or revocation — called by the scheduled cleanup job. */
export async function purgeStaleSessions(olderThanDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
  const res = await prisma.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
  });
  return res.count;
}
