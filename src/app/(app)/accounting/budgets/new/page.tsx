import type { Metadata } from "next";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listFiscalYears } from "@/domain/accounting/fiscal";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, PanelBody, EmptyState } from "@/components/ui";
import { BudgetComposer } from "@/components/accounting/budget-controls";

export const metadata: Metadata = { title: "New Budget" };

export default async function NewBudgetPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("budgets.manage");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const { current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title={t("acct.newBudget")} /><Panel><EmptyState title={t("acct.noCompany")} /></Panel></>;

  const [fys, accounts] = await Promise.all([
    listFiscalYears(principal, current.id).catch(() => []),
    prisma.account.findMany({ where: { companyId: current.id, isActive: true, allowPosting: true, archivedAt: null, type: { in: ["revenue", "cogs", "expense", "other_income", "other_expense"] } }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href={`/accounting/budgets?company=${current.id}`} className="hover:text-ink-2">{t("acct.budgets")}</Link> / {t("acct.newCrumb")}</div>
      <PageHeader title={t("acct.newBudget")} description={`Legal company ${current.name} · ${current.baseCurrency}`} />
      <Panel>
        <PanelBody>
          <BudgetComposer companyId={current.id} accounts={accounts.map((a) => ({ id: a.id, label: `${a.code} ${a.name}` }))} fiscalYears={fys.map((f) => ({ id: f.id, name: f.name }))} />
        </PanelBody>
      </Panel>
    </>
  );
}
