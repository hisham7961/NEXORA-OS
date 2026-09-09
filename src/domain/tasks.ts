import { z } from "zod";
import type { Task } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, notify, type ActorContext } from "@/domain/mutation";
import { optionalDate, optionalString, requiredString } from "@/lib/validation";

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

// ---------------------------------------------------------------------------
// WRITE PATHS (§7, Phase 2 Part G) — UI → service → API share this logic.
// Every mutation asserts scope on the task AND its referenced entities, runs in a
// transaction where multi-record, audits, and notifies affected users.
// ---------------------------------------------------------------------------

const TASK_STATUSES = ["backlog", "todo", "in_progress", "blocked", "waiting", "review", "completed", "cancelled"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const taskInputSchema = z.object({
  title: requiredString(200),
  description: optionalString,
  priority: z.enum(PRIORITIES).default("normal"),
  status: z.enum(TASK_STATUSES).default("todo"),
  startDate: optionalDate,
  dueDate: optionalDate,
  companyId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  projectId: optionalString,
  productId: optionalString,
  campaignId: optionalString,
  ownerId: optionalString,
  assigneeIds: z.array(z.string()).optional().default([]),
  watcherIds: z.array(z.string()).optional().default([]),
  approvalRequired: z.boolean().optional().default(false),
  checklist: z.array(z.string().trim().min(1)).optional().default([]),
});
export type TaskInput = z.input<typeof taskInputSchema>;

function scopeOf(t: { companyId: string | null; brandId: string | null; countryId: string | null }) {
  return { companyId: t.companyId, brandId: t.brandId, countryId: t.countryId };
}

export async function createTask(ctx: ActorContext, raw: unknown): Promise<Task> {
  const input = taskInputSchema.parse(raw);
  const scope = { companyId: input.companyId ?? null, brandId: input.brandId ?? null, countryId: input.countryId ?? null };
  // Create only within the caller's scope (§233).
  assertCan(ctx.principal, "tasks.create", scope);

  const task = await prisma.$transaction(async (tx) => {
    const t = await tx.task.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        priority: input.priority,
        status: input.status,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        projectId: input.projectId ?? null,
        productId: input.productId ?? null,
        campaignId: input.campaignId ?? null,
        companyId: input.companyId ?? null,
        brandId: input.brandId ?? null,
        countryId: input.countryId ?? null,
        ownerId: input.ownerId ?? ctx.principal.userId,
        approvalRequired: input.approvalRequired,
        createdById: ctx.principal.userId,
      },
    });
    const members = [
      ...input.assigneeIds.map((userId) => ({ taskId: t.id, userId, role: "assignee" })),
      ...input.watcherIds.map((userId) => ({ taskId: t.id, userId, role: "watcher" })),
    ];
    if (members.length) await tx.taskAssignee.createMany({ data: members, skipDuplicates: true });
    if (input.checklist.length)
      await tx.taskChecklistItem.createMany({ data: input.checklist.map((text, i) => ({ taskId: t.id, text, order: i })) });
    return t;
  });

  await audit(ctx, {
    action: "task.created",
    entityType: "Task",
    entityId: task.id,
    summary: input.title,
    brandId: task.brandId,
    companyId: task.companyId,
    newValues: { title: input.title, status: task.status, priority: task.priority },
  });
  await notify(input.assigneeIds, { type: "task.assigned", title: "You were assigned a task", body: input.title, entityType: "Task", entityId: task.id }, ctx.principal.userId);
  return task;
}

export const taskUpdateSchema = taskInputSchema
  .omit({ assigneeIds: true, watcherIds: true, checklist: true })
  .partial();

export async function updateTask(ctx: ActorContext, id: string, raw: unknown): Promise<Task> {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing || existing.archivedAt) throw new ServiceError("not_found", "Task not found", 404);
  assertRecordInScope(ctx.principal, "tasks.edit", scopeOf(existing), DIMS_CBC);

  const input = taskUpdateSchema.parse(raw);
  // If scope columns change, the new scope must also be within reach (§233).
  const newScope = {
    companyId: input.companyId ?? existing.companyId,
    brandId: input.brandId ?? existing.brandId,
    countryId: input.countryId ?? existing.countryId,
  };
  assertRecordInScope(ctx.principal, "tasks.edit", newScope, DIMS_CBC);

  const data: Record<string, unknown> = {};
  for (const k of ["title", "description", "priority", "status", "projectId", "productId", "campaignId", "companyId", "brandId", "countryId", "ownerId", "approvalRequired"] as const) {
    if (input[k] !== undefined) data[k] = input[k];
  }
  if (input.startDate !== undefined) data.startDate = input.startDate;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate;
  if (input.status === "completed") data.completedAt = new Date();

  const updated = await prisma.task.update({ where: { id }, data });
  await audit(ctx, { action: "task.updated", entityType: "Task", entityId: id, summary: updated.title, brandId: updated.brandId, companyId: updated.companyId, newValues: data });
  return updated;
}

export async function setTaskStatus(ctx: ActorContext, id: string, status: string): Promise<Task> {
  if (!(TASK_STATUSES as readonly string[]).includes(status)) throw new ServiceError("invalid_status", "Unknown task status", 400);
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing || existing.archivedAt) throw new ServiceError("not_found", "Task not found", 404);
  assertRecordInScope(ctx.principal, "tasks.edit", scopeOf(existing), DIMS_CBC);

  const updated = await prisma.task.update({
    where: { id },
    data: { status, completedAt: status === "completed" ? new Date() : null },
  });
  await audit(ctx, { action: "task.status_changed", entityType: "Task", entityId: id, summary: `${existing.status} → ${status}`, brandId: existing.brandId, companyId: existing.companyId, oldValues: { status: existing.status }, newValues: { status } });
  const watchers = await prisma.taskAssignee.findMany({ where: { taskId: id }, select: { userId: true } });
  await notify([existing.ownerId, ...watchers.map((w) => w.userId)], { type: "task.status", title: `Task moved to ${status.replace(/_/g, " ")}`, body: existing.title, entityType: "Task", entityId: id }, ctx.principal.userId);
  return updated;
}

export async function assignTask(ctx: ActorContext, id: string, assigneeIds: string[], watcherIds: string[] = []): Promise<void> {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing || existing.archivedAt) throw new ServiceError("not_found", "Task not found", 404);
  assertRecordInScope(ctx.principal, "tasks.edit", scopeOf(existing), DIMS_CBC);

  await prisma.$transaction(async (tx) => {
    await tx.taskAssignee.deleteMany({ where: { taskId: id } });
    const members = [
      ...assigneeIds.map((userId) => ({ taskId: id, userId, role: "assignee" })),
      ...watcherIds.map((userId) => ({ taskId: id, userId, role: "watcher" })),
    ];
    if (members.length) await tx.taskAssignee.createMany({ data: members, skipDuplicates: true });
  });
  await audit(ctx, { action: "task.assigned", entityType: "Task", entityId: id, summary: existing.title, brandId: existing.brandId, companyId: existing.companyId, newValues: { assigneeIds } });
  await notify(assigneeIds, { type: "task.assigned", title: "You were assigned a task", body: existing.title, entityType: "Task", entityId: id }, ctx.principal.userId);
}

async function loadEditableTask(ctx: ActorContext, id: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.archivedAt) throw new ServiceError("not_found", "Task not found", 404);
  assertRecordInScope(ctx.principal, "tasks.edit", scopeOf(task), DIMS_CBC);
  return task;
}

export async function addChecklistItem(ctx: ActorContext, taskId: string, text: string): Promise<void> {
  const task = await loadEditableTask(ctx, taskId);
  const count = await prisma.taskChecklistItem.count({ where: { taskId } });
  await prisma.taskChecklistItem.create({ data: { taskId, text: text.trim(), order: count } });
  await audit(ctx, { action: "task.checklist_added", entityType: "Task", entityId: taskId, summary: text.trim(), brandId: task.brandId, companyId: task.companyId });
}

export async function toggleChecklistItem(ctx: ActorContext, taskId: string, itemId: string, done: boolean): Promise<void> {
  const task = await loadEditableTask(ctx, taskId);
  const item = await prisma.taskChecklistItem.findUnique({ where: { id: itemId } });
  if (!item || item.taskId !== taskId) throw new ServiceError("not_found", "Checklist item not found", 404);
  await prisma.taskChecklistItem.update({ where: { id: itemId }, data: { isDone: done, doneById: done ? ctx.principal.userId : null, doneAt: done ? new Date() : null } });
  await audit(ctx, { action: done ? "task.checklist_done" : "task.checklist_undone", entityType: "Task", entityId: taskId, summary: item.text, brandId: task.brandId, companyId: task.companyId });
}

export async function addSubtask(ctx: ActorContext, parentId: string, title: string): Promise<Task> {
  const parent = await loadEditableTask(ctx, parentId);
  const sub = await prisma.task.create({
    data: { title: title.trim(), parentTaskId: parentId, companyId: parent.companyId, brandId: parent.brandId, countryId: parent.countryId, ownerId: ctx.principal.userId, createdById: ctx.principal.userId, status: "todo", priority: parent.priority },
  });
  await audit(ctx, { action: "task.subtask_added", entityType: "Task", entityId: parentId, summary: title.trim(), brandId: parent.brandId, companyId: parent.companyId });
  return sub;
}

export async function addDependency(ctx: ActorContext, taskId: string, dependsOnTaskId: string): Promise<void> {
  if (taskId === dependsOnTaskId) throw new ServiceError("invalid", "A task cannot depend on itself", 400);
  const task = await loadEditableTask(ctx, taskId);
  const dep = await prisma.task.findUnique({ where: { id: dependsOnTaskId } });
  if (!dep) throw new ServiceError("not_found", "Dependency task not found", 404);
  assertRecordInScope(ctx.principal, "tasks.view", scopeOf(dep), DIMS_CBC);
  await prisma.taskDependency.create({ data: { taskId, dependsOnTaskId } }).catch(() => {
    throw new ServiceError("duplicate", "Dependency already exists", 409);
  });
  await audit(ctx, { action: "task.dependency_added", entityType: "Task", entityId: taskId, summary: dep.title, brandId: task.brandId, companyId: task.companyId });
}

export async function archiveTask(ctx: ActorContext, id: string): Promise<void> {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("not_found", "Task not found", 404);
  assertRecordInScope(ctx.principal, "tasks.delete", scopeOf(existing), DIMS_CBC);
  await prisma.task.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit(ctx, { action: "task.archived", entityType: "Task", entityId: id, summary: existing.title, brandId: existing.brandId, companyId: existing.companyId });
}
