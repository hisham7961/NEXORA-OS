import type { Metadata } from "next";
import { BookOpenCheck } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listChartOfAccounts } from "@/domain/accounting/accounts";
import { PageHeader, Panel, DataTable, Badge, EmptyState, type Column } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";
import { NewAccountButton } from "@/components/accounting/setup-controls";

export const metadata: Metadata = { title: "Chart of Accounts" };

const TYPE_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { asset: "info", liability: "warning", equity: "neutral", revenue: "success", cogs: "warning", expense: "critical", other_income: "success", other_expense: "critical" };

export default async function ChartOfAccountsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("accounts.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title={t("acct.chart")} /><Panel><EmptyState title={t("acct.noCompany")} /></Panel></>;

  const accounts = await listChartOfAccounts(principal, current.id, { includeInactive: true }).catch(() => []);
  type Row = (typeof accounts)[number];
  const canManage = principal.isSuperAdmin || accounts.length >= 0; // view gate already applied

  const columns: Column<Row>[] = [
    { key: "code", header: t("common.code"), render: (a) => <span className="font-mono text-ink-2" style={{ paddingInlineStart: `${a.level * 12}px` }}>{a.code}</span> },
    { key: "name", header: t("acct.col.account"), render: (a) => <span className="text-ink">{a.name}{a.isSystem ? <Badge category="info" className="ms-2">system</Badge> : null}</span> },
    { key: "type", header: t("common.type"), render: (a) => <Badge category={TYPE_CAT[a.type] ?? "neutral"}>{a.type}</Badge> },
    { key: "normal", header: "Normal", render: (a) => <span className="text-ink-3 capitalize">{a.normalBalance}</span> },
    { key: "posting", header: "Posting", align: "center", render: (a) => (a.allowPosting ? <span className="text-success">✓</span> : <span className="text-ink-3">header</span>) },
    { key: "active", header: t("common.status"), align: "end", render: (a) => <Badge category={a.isActive ? "success" : "neutral"}>{a.isActive ? "active" : "inactive"}</Badge> },
  ];

  return (
    <>
      <PageHeader title={t("acct.chart")} description={`Hierarchical accounts for ${current.name} — never deleted with ledger history.`}
        actions={<div className="flex items-center gap-2"><CompanyPicker companies={companies} current={current.id} />{canManage && <NewAccountButton companyId={current.id} />}</div>} />
      <Panel>
        <DataTable columns={columns} rows={accounts} getRowKey={(a) => a.id}
          empty={<EmptyState icon={<BookOpenCheck className="h-5 w-5" />} title="No accounts" description="Set up accounting from the overview to generate a standard chart." />} />
      </Panel>
    </>
  );
}
