import type { Metadata } from "next";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { prisma } from "@/lib/db";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { PageHeader, Panel, PanelHeader, PanelBody, Badge, Metric, EmptyState } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";
import { SetupAccountingButton, NewFiscalYearButton, PeriodStatusButton } from "@/components/accounting/setup-controls";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Accounting" };

const PERIOD_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { open: "success", soft_closed: "warning", closed: "neutral", locked: "critical" };

export default async function AccountingPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("accounting.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);

  if (!current) return <><PageHeader title="Accounting" /><Panel><EmptyState icon={<Landmark className="h-5 w-5" />} title="No company in scope" description="You don't have accounting access to any legal company." /></Panel></>;

  const [settings, fiscalYears, accountCount, postedCount] = await Promise.all([
    prisma.companyAccountingSettings.findUnique({ where: { companyId: current.id } }),
    prisma.fiscalYear.findMany({ where: { companyId: current.id }, include: { periods: { orderBy: { startDate: "asc" } } }, orderBy: { startDate: "desc" } }),
    prisma.account.count({ where: { companyId: current.id, archivedAt: null } }),
    prisma.journalEntry.count({ where: { companyId: current.id, status: "posted" } }),
  ]);

  return (
    <>
      <PageHeader title="Accounting" description="The financial system of record for each legal company — double-entry, immutable postings (Phase 3)."
        actions={<CompanyPicker companies={companies} current={current.id} />} />

      {!settings ? (
        <Panel>
          <PanelBody className="flex flex-col items-center gap-3 py-10 text-center">
            <Landmark className="h-8 w-8 text-ink-3" />
            <div><div className="text-[15px] font-medium text-ink">{current.name} is not set up for accounting yet</div>
              <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-3">Initialize a standard chart of accounts, journals and system-account mappings in the company base currency ({current.baseCurrency}). You can customize everything afterwards.</p></div>
            <SetupAccountingButton companyId={current.id} baseCurrency={current.baseCurrency} />
          </PanelBody>
        </Panel>
      ) : (
        <>
          <Panel className="mb-4">
            <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
              <Metric label="Base currency" value={settings.baseCurrency} />
              <Metric label="Accounts" value={accountCount} />
              <Metric label="Posted entries" value={postedCount} category="info" />
              <Metric label="Payment terms" value={`${settings.defaultPaymentTerms}d`} />
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <PanelHeader title="Fiscal years & periods" icon={<Landmark className="h-4 w-4" />} action={<NewFiscalYearButton companyId={current.id} />} />
              {fiscalYears.length === 0 ? (
                <EmptyState title="No fiscal year" description="Create a fiscal year to generate accounting periods." />
              ) : (
                <div className="divide-y divide-line">
                  {fiscalYears.map((fy) => (
                    <div key={fy.id} className="px-4 py-3">
                      <div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-medium text-ink">{fy.name}</span><Badge category={fy.status === "open" ? "success" : "neutral"}>{fy.status}</Badge></div>
                      <div className="flex flex-wrap gap-1.5">
                        {fy.periods.map((p) => (
                          <span key={p.id} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[11px]">
                            <Badge category={PERIOD_CAT[p.status] ?? "neutral"} dot>{p.name}</Badge>
                            <PeriodStatusButton periodId={p.id} status={p.status} />
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel>
              <PanelHeader title="Quick links" />
              <ul className="divide-y divide-line text-[13px]">
                <li><Link href={`/accounting/accounts?company=${current.id}`} className="block px-4 py-2.5 text-ink hover:bg-surface-2">Chart of Accounts →</Link></li>
                <li><Link href={`/accounting/journal?company=${current.id}`} className="block px-4 py-2.5 text-ink hover:bg-surface-2">Post a Journal Entry →</Link></li>
                <li><Link href={`/accounting/reports?company=${current.id}`} className="block px-4 py-2.5 text-ink hover:bg-surface-2">Financial Reports →</Link></li>
              </ul>
              <PanelHeader title="System accounts" />
              <PanelBody>
                <p className="text-[12px] text-ink-3">Receivable, payable, revenue, COGS, tax and FX accounts are mapped in settings and drive automatic postings. They are protected from deletion.</p>
              </PanelBody>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
