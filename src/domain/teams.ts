import { z } from "zod";
import { prisma } from "@/lib/db";
import { type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_BRAND } from "@/domain/scope";

/** Teams list query = base list params + module-specific filters. */
export const teamQuerySchema = listQuerySchema.extend({ brandId: z.string().optional() });
export type TeamQuery = z.infer<typeof teamQuerySchema>;

export interface TeamRow {
  id: string;
  name: string;
  brandId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  leadUserId: string | null;
  memberCount: number;
}

export async function listTeams(principal: Principal, query: TeamQuery): Promise<{ rows: TeamRow[]; total: number }> {
  // Team carries only brandId as a scope dimension (no company/country column).
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "teams.view", DIMS_BRAND, {
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q } }] } : {}),
    }),
  };

  const [teams, total] = await Promise.all([
    prisma.team.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.team.count({ where }),
  ]);

  const ids = teams.map((t) => t.id);
  const memberGroups = await prisma.teamMember.groupBy({ by: ["teamId"], where: { teamId: { in: ids } }, _count: true });
  const mc = new Map(memberGroups.map((g) => [g.teamId, g._count]));

  // Departments are not part of the shared lookups set; resolve names once.
  const deptIds = [...new Set(teams.map((t) => t.departmentId).filter((d): d is string => !!d))];
  const depts = deptIds.length
    ? await prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })
    : [];
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));

  return {
    rows: teams.map((t) => ({
      id: t.id,
      name: t.name,
      brandId: t.brandId,
      departmentId: t.departmentId,
      departmentName: t.departmentId ? deptMap.get(t.departmentId) ?? null : null,
      leadUserId: t.leadUserId,
      memberCount: (mc.get(t.id) as number) ?? 0,
    })),
    total,
  };
}
