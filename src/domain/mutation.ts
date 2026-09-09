import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { can, assertRecordInScope, ForbiddenError, type Principal, type ScopeContext } from "@/lib/permissions/engine";
import type { ScopeDimension } from "@/lib/permissions/catalog";

/**
 * MUTATION FOUNDATION (Phase 2, Part F/T/V).
 * Shared building blocks so every write path is consistent: permission assertion,
 * audit, notifications, and a readable activity timeline (sourced from AuditLog,
 * §47 — not raw JSON). Transactions use prisma.$transaction directly in services.
 */

export interface ActorContext {
  principal: Principal;
  ip?: string | null;
  userAgent?: string | null;
}

/** Throw ForbiddenError unless the principal has the permission (optionally scoped). */
export function assertCan(principal: Principal, key: string, ctx?: ScopeContext): void {
  if (!can(principal, key, ctx)) throw new ForbiddenError(key);
}

export { assertRecordInScope, ForbiddenError };

export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  brandId?: string | null;
  companyId?: string | null;
}

/** Write an audit entry attributed to the actor (§31, Part T). */
export async function audit(ctx: ActorContext, input: AuditInput): Promise<void> {
  await writeAudit({
    actorId: ctx.principal.userId,
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent ?? null,
    ...input,
  });
}

export interface NotifyInput {
  type: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

/** Create in-app notifications for a set of users (deduped; self excluded optionally). */
export async function notify(userIds: (string | null | undefined)[], n: NotifyInput, excludeUserId?: string): Promise<void> {
  const unique = [...new Set(userIds.filter((id): id is string => !!id))].filter((id) => id !== excludeUserId);
  if (unique.length === 0) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      entityType: n.entityType ?? null,
      entityId: n.entityId ?? null,
    })),
  });
}

export interface ActivityItem {
  id: string;
  at: Date;
  actorId: string | null;
  action: string;
  summary: string | null;
}

/** Readable activity timeline for an entity, derived from the audit trail (§47). */
export async function getActivity(entityType: string, entityId: string, take = 50): Promise<ActivityItem[]> {
  const logs = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return logs.map((l) => ({ id: l.id, at: l.createdAt, actorId: l.actorId, action: l.action, summary: l.summary }));
}

export const DIMS_CBC: ScopeDimension[] = ["companyId", "brandId", "countryId"];
