import { z } from "zod";
import { prisma } from "@/lib/db";
import { listQuerySchema } from "@/lib/api/pagination";

/** Audit Explorer (§31). */
export const auditQuerySchema = listQuerySchema.extend({ entityType: z.string().optional(), action: z.string().optional() });
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export async function listAudit(query: AuditQuery) {
  const where: Record<string, unknown> = {
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.action ? { action: { contains: query.action, mode: "insensitive" } } : {}),
    ...(query.q ? { OR: [{ action: { contains: query.q, mode: "insensitive" } }, { summary: { contains: query.q, mode: "insensitive" } }] } : {}),
  };
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.auditLog.count({ where }),
  ]);
  const actorIds = [...new Set(logs.map((l) => l.actorId).filter(Boolean) as string[])];
  const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, avatarColor: true } }) : [];
  const actorMap = new Map(actors.map((a) => [a.id, a]));
  const rows = logs.map((l) => ({ ...l, actor: l.actorId ? actorMap.get(l.actorId) ?? null : null }));

  const entityTypes = await prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, take: 40 });
  return { rows, total, entityTypes: entityTypes.map((e) => e.entityType) };
}
