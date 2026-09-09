import { prisma } from "@/lib/db";
import { type Principal } from "@/lib/permissions/engine";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";

/** Management analytics (§27) — every tile answers a business question. */
export async function getAnalyticsOverview(principal: Principal) {
  const now = new Date();
  const [liveCampaigns, activeRegs, openCases, revenueAgg, spendAgg, tasksDone, tasksTotal] = await Promise.all([
    prisma.campaign.count({ where: { archivedAt: null, status: { in: ["live", "monitoring"] }, ...scopedWhere(principal, "campaigns.view", DIMS_CBC, {}) } }),
    prisma.registrationCase.count({ where: { archivedAt: null, status: { notIn: ["registered", "rejected", "expired"] }, ...scopedWhere(principal, "registrations.view", DIMS_CBC, {}) } }),
    prisma.customerCase.count({ where: { archivedAt: null, status: { notIn: ["resolved", "closed"] }, ...scopedWhere(principal, "cases.view", DIMS_CBC, {}) } }),
    prisma.campaignMetric.aggregate({ _sum: { value: true }, where: { name: "revenue" } }),
    prisma.campaignMetric.aggregate({ _sum: { value: true }, where: { name: "spend" } }),
    prisma.task.count({ where: { archivedAt: null, status: "completed", ...scopedWhere(principal, "tasks.view", DIMS_CBC, {}) } }),
    prisma.task.count({ where: { archivedAt: null, ...scopedWhere(principal, "tasks.view", DIMS_CBC, {}) } }),
  ]);

  const revenue = Number(revenueAgg._sum.value ?? 0);
  const spend = Number(spendAgg._sum.value ?? 0);
  const roas = spend > 0 ? revenue / spend : 0;
  const completion = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  return {
    marketing: { liveCampaigns, revenue, spend, roas, since: now },
    regulatory: { activeRegs },
    service: { openCases },
    operations: { completion, tasksDone, tasksTotal },
  };
}
