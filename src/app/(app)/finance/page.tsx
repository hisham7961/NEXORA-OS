import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { getFinanceOverview } from "@/domain/finance";
import { PageHeader, Panel, PanelHeader, DataTable, Metric, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Finance" };
import { getServerI18n } from "@/lib/server-i18n";

export default async function FinancePage() {
  const { principal, locale, denied } = await pageGuard("finance.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const { canValues, counts, marketingSpend, recentEntries } = await getFinanceOverview(principal);

  return (
    <>
      <PageHeader title={t("finance.title")} description={t("finance.subtitle")} />
      <Panel className="mb-4">
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Metric label="Chart of accounts" value={counts.accounts} />
          <Metric label="Journal entries" value={counts.journalEntries} />
          <Metric label="Open invoices" value={counts.openInvoices} category={counts.openInvoices > 0 ? "warning" : "neutral"} />
          <Metric label="Marketing spend" value={canValues ? formatCurrency(marketingSpend, "KWD", locale) : "•••"} />
        </div>
      </Panel>
      <Panel>
        <PanelHeader title={t("finance.recentJournals")} />
        <DataTable
          columns={[
            { key: "date", header: t("common.date"), render: (e) => formatDate(e.date, locale) },
            { key: "ref", header: "Reference", render: (e) => <span className="font-mono text-xs text-ink-3">{e.reference ?? "—"}</span> },
            { key: "memo", header: t("finance.col.memo"), render: (e) => e.memo ?? "—" },
            { key: "currency", header: "Currency", render: (e) => <span className="text-ink-3">{e.currency}</span> },
            { key: "status", header: "Status", align: "end", render: (e) => <span className="capitalize text-ink-2">{e.status}</span> },
          ]}
          rows={recentEntries}
          getRowKey={(e) => e.id}
          empty={<EmptyState title={t("finance.empty")} description={t("finance.emptyBody")} />}
        />
      </Panel>
    </>
  );
}
