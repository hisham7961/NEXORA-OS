import { prisma } from "@/lib/db";
import type { Principal } from "@/lib/permissions/engine";

export interface MyDayData {
  tasks: { id: string; title: string; status: string; priority: string; dueDate: Date | null; brandId: string | null }[];
  checks: { id: string; templateName: string; status: string; total: number; done: number }[];
  approvals: { id: string; title: string; requestId: string }[];
  deadlines: { id: string; title: string; dueDate: Date; kind: string }[];
  attendanceToday: { status: string; checkedIn: boolean } | null;
  // My Day 2.0 (§21) — everything the operator owns today, scoped to them.
  mentions: { id: string; title: string; body: string | null; channelId: string | null }[];
  cases: { id: string; type: string; status: string; priority: string }[];
  designs: { id: string; assetType: string; status: string }[];
  campaigns: { id: string; name: string; status: string }[];
  publishingToday: { id: string; contentType: string; platform: string | null; status: string }[];
  registrations: { id: string; label: string; stage: string; dueDate: Date | null }[];
  renewals: { id: string; provider: string; renewalDate: Date | null }[];
  unreadDiscussions: number;
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

  // --- My Day 2.0 sources — all keyed to the user (assignment/ownership) ---
  const [mentionNotifs, caseRows, designRows, campaignRows, pubRows, regRows, renewalRows, memberships] = await Promise.all([
    prisma.notification.findMany({ where: { userId: uid, type: "discussion.mention", state: "unread" }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.customerCase.findMany({ where: { assignedToId: uid, archivedAt: null, status: { notIn: ["resolved", "closed"] } }, orderBy: { updatedAt: "desc" }, take: 10 }),
    prisma.designRequest.findMany({ where: { designerId: uid, archivedAt: null, status: { notIn: ["delivered", "published", "archived"] } }, orderBy: { updatedAt: "desc" }, take: 10 }),
    prisma.campaign.findMany({ where: { ownerId: uid, archivedAt: null, status: { notIn: ["completed", "cancelled"] } }, orderBy: { updatedAt: "desc" }, take: 10 }),
    prisma.publishingItem.findMany({ where: { ownerId: uid, archivedAt: null, publishDate: { gte: startOfToday, lt: endOfToday }, status: { notIn: ["published", "cancelled"] } }, orderBy: { publishTime: "asc" }, take: 10 }),
    prisma.registrationCase.findMany({ where: { archivedAt: null, assignedToId: uid, status: { notIn: ["approved", "rejected", "closed"] } }, orderBy: { expiryDate: "asc" }, take: 10 }),
    prisma.subscription.findMany({ where: { ownerId: uid, archivedAt: null, status: "active", renewalDate: { gte: startOfToday, lte: in7 } }, orderBy: { renewalDate: "asc" }, take: 10 }),
    prisma.channelMember.findMany({ where: { userId: uid }, select: { channelId: true, lastReadAt: true } }),
  ]);

  // Unread discussion count: channels with messages from others after my lastReadAt.
  // One grouped query for the newest foreign message per channel, compared in memory
  // to each channel's lastReadAt — avoids a per-channel COUNT (N+1) round-trip.
  const channelIds = memberships.map((m) => m.channelId);
  const latestForeign = channelIds.length
    ? await prisma.message.groupBy({
        by: ["channelId"],
        where: { channelId: { in: channelIds }, archivedAt: null, authorId: { not: uid } },
        _max: { createdAt: true },
      })
    : [];
  const latestByChannel = new Map(latestForeign.map((r) => [r.channelId, r._max.createdAt]));
  let unreadDiscussions = 0;
  for (const m of memberships) {
    const latest = latestByChannel.get(m.channelId);
    if (latest && (!m.lastReadAt || latest > m.lastReadAt)) unreadDiscussions++;
  }

  return {
    tasks,
    checks,
    approvals,
    deadlines,
    attendanceToday: attendance ? { status: attendance.status, checkedIn: !!attendance.actualStart } : null,
    mentions: mentionNotifs.map((n) => ({ id: n.id, title: n.title, body: n.body, channelId: n.entityId })),
    cases: caseRows.map((c) => ({ id: c.id, type: c.type, status: c.status, priority: c.priority })),
    designs: designRows.map((d) => ({ id: d.id, assetType: d.assetType, status: d.status })),
    campaigns: campaignRows.map((c) => ({ id: c.id, name: c.name, status: c.status })),
    publishingToday: pubRows.map((p) => ({ id: p.id, contentType: p.contentType, platform: p.platform, status: p.status })),
    registrations: regRows.map((r) => ({ id: r.id, label: r.registrationNumber ?? r.agentName ?? "Registration", stage: r.status, dueDate: r.expiryDate })),
    renewals: renewalRows.map((s) => ({ id: s.id, provider: s.provider, renewalDate: s.renewalDate })),
    unreadDiscussions,
  };
}
