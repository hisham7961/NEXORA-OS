import { prisma } from "@/lib/db";
import type { Principal } from "@/lib/permissions/engine";

export interface MyDayData {
  tasks: { id: string; title: string; status: string; priority: string; dueDate: Date | null; brandId: string | null }[];
  checks: { id: string; templateName: string; status: string; total: number; done: number }[];
  approvals: { id: string; title: string; requestId: string }[];
  deadlines: { id: string; title: string; dueDate: Date; kind: string }[];
  attendanceToday: { status: string; checkedIn: boolean } | null;
}

export async function getMyDay(principal: Principal): Promise<MyDayData> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);
  const in7 = new Date(now.getTime() + 7 * 86_400_000);
  const uid = principal.userId;

  const [taskRows, assigneeRows, checkInstances, approvalSteps, attendance] = await Promise.all([
    prisma.task.findMany({
      where: { archivedAt: null, status: { notIn: ["completed", "cancelled"] }, ownerId: uid },
      orderBy: [{ dueDate: "asc" }],
      take: 25,
    }),
    prisma.taskAssignee.findMany({
      where: { userId: uid, role: "assignee" },
      select: { taskId: true },
      take: 50,
    }),
    prisma.checklistInstance.findMany({
      where: { userId: uid, date: { gte: startOfToday, lt: endOfToday } },
      include: { template: true, items: true },
    }),
    prisma.approvalStep.findMany({
      where: { approverUserId: uid, status: "pending", request: { status: "pending" } },
      include: { request: true },
      take: 25,
    }),
    prisma.attendanceRecord.findFirst({ where: { userId: uid, date: { gte: startOfToday, lt: endOfToday } } }),
  ]);

  // Merge owned + assigned tasks (deduped).
  const assignedIds = assigneeRows.map((a) => a.taskId).filter((id) => !taskRows.some((t) => t.id === id));
  const assignedTasks = assignedIds.length
    ? await prisma.task.findMany({
        where: { id: { in: assignedIds }, archivedAt: null, status: { notIn: ["completed", "cancelled"] } },
        orderBy: [{ dueDate: "asc" }],
      })
    : [];

  const tasks = [...taskRows, ...assignedTasks]
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))
    .slice(0, 20)
    .map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, brandId: t.brandId }));

  const checks = checkInstances.map((ci) => ({
    id: ci.id,
    templateName: ci.template.name,
    status: ci.status,
    total: ci.items.length,
    done: ci.items.filter((i) => i.isDone).length,
  }));

  const approvals = approvalSteps.map((s) => ({ id: s.id, title: s.request.title, requestId: s.requestId }));

  const deadlines = tasks
    .filter((t) => t.dueDate && t.dueDate >= now && t.dueDate <= in7)
    .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate as Date, kind: "task" }));

  return {
    tasks,
    checks,
    approvals,
    deadlines,
    attendanceToday: attendance ? { status: attendance.status, checkedIn: !!attendance.actualStart } : null,
  };
}
