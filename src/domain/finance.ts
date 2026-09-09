import { prisma } from "@/lib/db";
import { canAnywhere, type Principal } from "@/lib/permissions/engine";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";

/** Finance overview (§26). Financial values are gated by finance.view_values (§3). */
export async function getFinanceOverview(principal: Principal) {
  const canValues = canAnywhere(principal, "finance.view_values");

  const campaignWhere = { archivedAt: null, ...scopedWhere(principal, "campaigns.view", DIMS_CBC, {}) };
  const [accounts, journalEntries, openInvoices, recentEntries, campaigns] = await Promise.all([
    prisma.account.count(),
    prisma.journalEntry.count(),
    prisma.invoice.count({ where: { status: { in: ["open", "overdue"] } } }),
    prisma.journalEntry.findMany({ orderBy: { date: "desc" }, take: 12 }),
    prisma.campaign.findMany({ where: campaignWhere, select: { actualSpend: true, currency: true } }),
  ]);

  const marketingSpend = campaigns.reduce((sum, c) => sum + Number(c.actualSpend ?? 0), 0);

  return {
    canValues,
    counts: { accounts, journalEntries, openInvoices },
    marketingSpend,
    recentEntries,
  };
}
