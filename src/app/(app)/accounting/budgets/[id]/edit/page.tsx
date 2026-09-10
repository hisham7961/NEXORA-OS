import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { ForbiddenError } from "@/lib/permissions/engine";
import { getBudget } from "@/domain/accounting/budgets";
import { listFiscalYears } from "@/domain/accounting/fiscal";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, PanelBody } from "@/components/ui";
import { BudgetComposer } from "@/components/accounting/budget-controls";

export const metadata: Metadata = { title: "Edit Budget" };

export default async function EditBudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale, denied } = await pageGuard("budgets.manage");
  if (denied) return <AccessDenied locale={locale} />;
  const { id } = await params;
  let budget;
  try { budget = await getBudget(principal, id); } catch (e) { if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />; throw e; }
  if (!budget) notFound();
  const companyId = budget.companyId ?? "";
  const [fys, accounts] = await Promise.all([
    listFiscalYears(principal, companyId).catch(() => []),
    prisma.account.findMany({ where: { companyId, isActive: true, allowPosting: true, archivedAt: null, type: { in: ["revenue", "cogs", "expense", "other_income", "other_expense"] } }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href={`/accounting/budgets/${id}`} className="hover:text-ink-2">{budget.name}</Link> / Edit</div>
      <PageHeader title={`Edit — ${budget.name}`} />
      <Panel>
        <PanelBody>
          <BudgetComposer companyId={companyId} accounts={accounts.map((a) => ({ id: a.id, label: `${a.code} ${a.name}` }))} fiscalYears={fys.map((f) => ({ id: f.id, name: f.name }))}
            budget={{ id: budget.id, name: budget.name, fiscalYearId: budget.fiscalYearId, currency: budget.currency, periodicity: budget.periodicity, lines: budget.lines.map((l) => ({ accountId: l.accountId, amount: l.amount.toString(), periodMonth: l.periodMonth })) }} />
        </PanelBody>
      </Panel>
    </>
  );
}
