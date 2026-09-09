import { prisma } from "@/lib/db";
import { canAnywhere, type Principal } from "@/lib/permissions/engine";
import { scopedWhere, DIMS_CBC } from "./scope";

export interface AttentionCard {
  id: string;
  label: string;
  count: number;
  tone: "critical" | "warning" | "info";
  href: string;
}

export interface OpsStat {
  id: string;
  label: string;
  value: number;
  href: string;
}

export interface CommandCenterData {
  attention: AttentionCard[];
  liveOps: OpsStat[];
  pulse: { id: string; label: string; value: string; sub?: string }[];
}

const TASK_OPEN = { notIn: ["completed", "cancelled"] };

export async function getCommandCenter(principal: Principal): Promise<CommandCenterData> {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86_400_000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);

  const can = (p: string) => canAnywhere(principal, p);

  const [
    overdueTasks,
    expiringDocs,
    expiredDocs,
    pendingApprovals,
    blockedRegs,
    staleCases,
    expiringSubs,
    missingChecks,
    activeCampaigns,
    regsInProgress,
    creativeInReview,
    openCases,
    todayPublishing,
    employeesTotal,
    presentToday,
    tasksDueToday,
    tasksDoneToday,
  ] = await Promise.all([
    can("tasks.view")
      ? prisma.task.count({
          where: scopedWhere(principal, "tasks.view", DIMS_CBC, {
            archivedAt: null,
            status: TASK_OPEN,
            dueDate: { lt: now },
          }),
        })
      : 0,
    can("documents.view")
      ? prisma.document.count({
          where: scopedWhere(principal, "documents.view", DIMS_CBC, {
            archivedAt: null,
            expiryDate: { gte: now, lte: in30 },
          }),
        })
      : 0,
    can("documents.view")
      ? prisma.document.count({
          where: scopedWhere(principal, "documents.view", DIMS_CBC, {
            archivedAt: null,
            expiryDate: { lt: now },
            status: { not: "replaced" },
          }),
        })
      : 0,
    can("approvals.view")
      ? prisma.approvalStep.count({
          where: { approverUserId: principal.userId, status: "pending", request: { status: "pending" } },
        })
      : 0,
    can("registrations.view")
      ? prisma.registrationCase.count({
          where: scopedWhere(principal, "registrations.view", DIMS_CBC, {
            archivedAt: null,
            status: { in: ["documents_missing", "additional_requirements", "payment_required", "samples_requested", "rejected"] },
          }),
        })
      : 0,
    can("cases.view")
      ? prisma.customerCase.count({
          where: scopedWhere(principal, "cases.view", DIMS_CBC, {
            archivedAt: null,
            status: { notIn: ["resolved", "closed"] },
            updatedAt: { lt: twoDaysAgo },
          }),
        })
      : 0,
    can("subscriptions.view")
      ? prisma.subscription.count({
          where: scopedWhere(principal, "subscriptions.view", DIMS_CBC, {
            archivedAt: null,
            status: { not: "cancelled" },
            renewalDate: { gte: now, lte: in30 },
          }),
        })
      : 0,
    can("daily_checks.view")
      ? prisma.checklistInstance.count({
          where: { date: { gte: startOfToday, lt: endOfToday }, status: { in: ["pending", "late", "missed"] } },
        })
      : 0,
    can("campaigns.view")
      ? prisma.campaign.count({
          where: scopedWhere(principal, "campaigns.view", DIMS_CBC, {
            archivedAt: null,
            status: { in: ["live", "monitoring", "scheduled"] },
          }),
        })
      : 0,
    can("registrations.view")
      ? prisma.registrationCase.count({
          where: scopedWhere(principal, "registrations.view", DIMS_CBC, {
            archivedAt: null,
            status: { in: ["preparation", "ready_submission", "submitted", "authority_review"] },
          }),
        })
      : 0,
    can("design.view")
      ? prisma.designRequest.count({
          where: scopedWhere(principal, "design.view", DIMS_CBC, {
            archivedAt: null,
            status: { in: ["internal_review", "waiting_approval", "revision"] },
          }),
        })
      : 0,
    can("cases.view")
      ? prisma.customerCase.count({
          where: scopedWhere(principal, "cases.view", DIMS_CBC, {
            archivedAt: null,
            status: { notIn: ["resolved", "closed"] },
          }),
        })
      : 0,
    can("social.view")
      ? prisma.publishingItem.count({
          where: scopedWhere(principal, "social.view", DIMS_CBC, {
            archivedAt: null,
            publishDate: { gte: startOfToday, lt: endOfToday },
          }),
        })
      : 0,
    can("employees.view") ? prisma.employee.count({ where: { archivedAt: null } }) : 0,
    can("attendance.view")
      ? prisma.attendanceRecord.count({ where: { date: { gte: startOfToday, lt: endOfToday }, status: "present" } })
      : 0,
    can("tasks.view")
      ? prisma.task.count({
          where: scopedWhere(principal, "tasks.view", DIMS_CBC, {
            archivedAt: null,
            dueDate: { gte: startOfToday, lt: endOfToday },
          }),
        })
      : 0,
    can("tasks.view")
      ? prisma.task.count({
          where: scopedWhere(principal, "tasks.view", DIMS_CBC, {
            status: "completed",
            completedAt: { gte: startOfToday, lt: endOfToday },
          }),
        })
      : 0,
  ]);

  const attentionAll: AttentionCard[] = [
    { id: "overdue-tasks", label: "Overdue tasks", count: overdueTasks, tone: "critical", href: "/tasks?filter=overdue" },
    { id: "expired-docs", label: "Expired certificates", count: expiredDocs, tone: "critical", href: "/documents?status=expired" },
    { id: "expiring-docs", label: "Certificates expiring soon", count: expiringDocs, tone: "warning", href: "/documents?status=expiring" },
    { id: "pending-approvals", label: "Approvals waiting for me", count: pendingApprovals, tone: "warning", href: "/approvals" },
    { id: "blocked-regs", label: "Registrations blocked", count: blockedRegs, tone: "warning", href: "/registrations?filter=blocked" },
    { id: "stale-cases", label: "Customer cases overdue", count: staleCases, tone: "warning", href: "/cases?filter=overdue" },
    { id: "missing-checks", label: "Daily checks not done", count: missingChecks, tone: "warning", href: "/daily-checks" },
    { id: "expiring-subs", label: "Subscriptions renewing soon", count: expiringSubs, tone: "info", href: "/subscriptions?filter=renewing" },
  ];
  const attention = attentionAll.filter((c) => c.count > 0);

  const liveOps: OpsStat[] = [
    { id: "active-campaigns", label: "Active campaigns", value: activeCampaigns, href: "/campaigns?status=live" },
    { id: "regs-in-progress", label: "Registrations in progress", value: regsInProgress, href: "/registrations" },
    { id: "creative-review", label: "Creative in review", value: creativeInReview, href: "/design" },
    { id: "open-cases", label: "Open customer cases", value: openCases, href: "/cases" },
    { id: "today-publishing", label: "Publishing today", value: todayPublishing, href: "/social" },
  ].filter((s) => canShowOps(principal, s.id));

  const attendancePct = employeesTotal > 0 ? Math.round((presentToday / employeesTotal) * 100) : 0;
  const workPct = tasksDueToday > 0 ? Math.round((tasksDoneToday / tasksDueToday) * 100) : 0;

  const pulse: CommandCenterData["pulse"] = [];
  if (can("attendance.view") && employeesTotal > 0) {
    pulse.push({ id: "attendance", label: "Attendance today", value: `${attendancePct}%`, sub: `${presentToday}/${employeesTotal} present` });
  }
  if (can("tasks.view")) {
    pulse.push({ id: "work", label: "Work completion today", value: `${workPct}%`, sub: `${tasksDoneToday}/${tasksDueToday} due tasks done` });
  }

  return { attention, liveOps, pulse };
}

function canShowOps(principal: Principal, id: string): boolean {
  switch (id) {
    case "active-campaigns": return canAnywhere(principal, "campaigns.view");
    case "regs-in-progress": return canAnywhere(principal, "registrations.view");
    case "creative-review": return canAnywhere(principal, "design.view");
    case "open-cases": return canAnywhere(principal, "cases.view");
    case "today-publishing": return canAnywhere(principal, "social.view");
    default: return true;
  }
}
