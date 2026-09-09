import { prisma } from "@/lib/db";
import type { Principal } from "@/lib/permissions/engine";

/** Daily compliance dashboard (§8). */
export interface ComplianceRow {
  id: string;
  userName: string;
  templateName: string;
  status: string;
  done: number;
  total: number;
}

export async function getDailyCompliance(_principal: Principal) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);

  const [instances, templates] = await Promise.all([
    prisma.checklistInstance.findMany({
      where: { date: { gte: startOfToday, lt: endOfToday } },
      include: { template: true, items: true },
    }),
    prisma.checklistTemplate.findMany({ where: { isActive: true }, include: { _count: { select: { items: true, assignments: true } } } }),
  ]);

  const userIds = [...new Set(instances.map((i) => i.userId))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const nameMap = new Map(users.map((u) => [u.id, u.name]));

  const rows: ComplianceRow[] = instances.map((i) => ({
    id: i.id,
    userName: nameMap.get(i.userId) ?? "—",
    templateName: i.template.name,
    status: i.status,
    done: i.items.filter((it) => it.isDone).length,
    total: i.items.length,
  }));

  const summary = {
    total: rows.length,
    complete: rows.filter((r) => r.status === "complete").length,
    pending: rows.filter((r) => r.status === "pending").length,
    late: rows.filter((r) => r.status === "late").length,
    missed: rows.filter((r) => r.status === "missed").length,
  };

  return { rows, templates, summary };
}
