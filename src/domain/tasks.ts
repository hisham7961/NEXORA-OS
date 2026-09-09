import { z } from "zod";
import type { Task } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";

/** Tasks list query (§7). `filter=overdue` surfaces the Command Center drill-in. */
export const taskQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  priority: z.string().optional(),
  brandId: z.string().optional(),
  filter: z.string().optional(),
});
export type TaskQuery = z.infer<typeof taskQuerySchema>;

const OPEN = { notIn: ["completed", "cancelled"] };

export async function listTasks(principal: Principal, query: TaskQuery): Promise<{ rows: Task[]; total: number }> {
  const extra: Record<string, unknown> = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.brandId ? { brandId: query.brandId } : {}),
    ...(query.q ? { OR: [{ title: { contains: query.q, mode: "insensitive" } }] } : {}),
    ...(query.filter === "overdue" ? { dueDate: { lt: new Date() }, status: OPEN } : {}),
  };
  const where: Record<string, unknown> = { archivedAt: null, ...scopedWhere(principal, "tasks.view", DIMS_CBC, extra) };

  const [rows, total] = await Promise.all([
    prisma.task.findMany({ where, orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.task.count({ where }),
  ]);
  return { rows, total };
}

export async function getTask(principal: Principal, id: string) {
  const task = await prisma.task.findUnique({ where: { id }, include: { assignees: true, checklist: { orderBy: { order: "asc" } } } });
  if (!task) return null;
  assertRecordInScope(principal, "tasks.view", { companyId: task.companyId, brandId: task.brandId, countryId: task.countryId }, DIMS_CBC);
  return task;
}
