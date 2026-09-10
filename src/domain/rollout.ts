import type { Principal } from "@/lib/permissions/engine";
import { assertCan } from "@/domain/mutation";
import { prisma } from "@/lib/db";
import { openingBalancesStatus } from "@/domain/accounting/opening-balances";

/**
 * Group rollout / go-live readiness (§70-77). A per-company checklist an admin works
 * through to bring a new company in the group live — accounting initialized, chart +
 * fiscal calendar in place, control accounts mapped, brands and users assigned, and
 * opening balances carried in — without touching the database or seed scripts. Each
 * item links to the screen that resolves it, so rollout is fully self-service.
 */
export interface GoLiveItem { key: string; label: string; done: boolean; href?: string; hint: string; required: boolean }
export interface GoLiveReport { companyId: string; ready: boolean; done: number; total: number; items: GoLiveItem[] }

export async function companyGoLiveStatus(principal: Principal, companyId: string): Promise<GoLiveReport> {
  assertCan(principal, "settings.view");
  const [settings, accountCount, fiscalYear, openPeriod, brandCount, userCount, opening] = await Promise.all([
    prisma.companyAccountingSettings.findUnique({ where: { companyId } }),
    prisma.account.count({ where: { companyId, archivedAt: null } }),
    prisma.fiscalYear.findFirst({ where: { companyId } }),
    prisma.accountingPeriod.findFirst({ where: { companyId, status: "open" } }),
    prisma.brand.count({ where: { primaryCompanyId: companyId, archivedAt: null } }),
    prisma.roleAssignment.count({ where: { companyId } }),
    openingBalancesStatus(principal, companyId),
  ]);

  const controlsMapped = !!(settings?.receivableAccountId && settings?.payableAccountId && settings?.cashAccountId);
  const items: GoLiveItem[] = [
    { key: "accounting", label: "Accounting initialized", done: !!settings, href: "/accounting/settings", hint: "Base currency, chart of accounts and standard journals are set up.", required: true },
    { key: "chart", label: "Chart of accounts present", done: accountCount > 0, href: "/accounting/accounts", hint: "At least one postable account exists.", required: true },
    { key: "controls", label: "Control accounts mapped", done: controlsMapped, href: "/accounting/settings", hint: "Receivable, payable and cash control accounts are chosen.", required: true },
    { key: "fiscal", label: "Fiscal calendar configured", done: !!fiscalYear && !!openPeriod, href: "/accounting/periods", hint: "A fiscal year with at least one open period exists.", required: true },
    { key: "opening", label: "Opening balances posted", done: opening.posted, href: "/accounting/opening-balances", hint: "Existing account balances are carried into the ledger.", required: true },
    { key: "brands", label: "Brands assigned", done: brandCount > 0, href: "/brands", hint: "At least one brand is linked to this company.", required: false },
    { key: "users", label: "Users have access", done: userCount > 0, href: "/admin/users", hint: "At least one user is assigned a role scoped to this company.", required: true },
  ];

  const requiredItems = items.filter((i) => i.required);
  return {
    companyId,
    ready: requiredItems.every((i) => i.done),
    done: items.filter((i) => i.done).length,
    total: items.length,
    items,
  };
}
