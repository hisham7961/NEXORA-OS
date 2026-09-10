import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { getSalesOverview } from "@/domain/stores";
import { PageHeader, Panel, PanelHeader, PanelBody, DataTable, Metric, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Sales" };
import { getServerI18n } from "@/lib/server-i18n";

export default async function SalesPage() {
  const { principal, locale, denied } = await pageGuard("sales.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const { storeCount, totals, rows } = await getSalesOverview(principal);

  return (
    <>
      <PageHeader title={t("sales.title")} description={t("sales.subtitle", { n: storeCount })} />
      <Panel className="mb-4">
        <PanelBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label={t("sal.title")} value={formatCurrency(totals.sales, "KWD", locale)} />
          <Metric label={t("sal.orders")} value={formatNumber(totals.orders, locale)} />
          <Metric label={t("sal.returns")} value={formatNumber(totals.returns, locale)} category={totals.returns > 0 ? "warning" : "neutral"} />
          <Metric label={t("sal.grossMargin")} value={formatCurrency(totals.margin, "KWD", locale)} category="success" />
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader title={t("sales.recentPerformance")} />
        <DataTable
          columns={[
            { key: "store", header: t("sales.col.store"), render: (p) => p.storeName },
            { key: "period", header: t("sales.col.period"), render: (p) => formatDate(p.periodStart, locale) },
            { key: "sales", header: t("sales.col.sales"), align: "end", render: (p) => formatCurrency(p.sales, "KWD", locale) },
            { key: "orders", header: t("sales.col.orders"), align: "end", render: (p) => formatNumber(p.orders, locale) },
            { key: "margin", header: t("sales.col.margin"), align: "end", render: (p) => formatCurrency(p.grossMargin, "KWD", locale) },
          ]}
          rows={rows}
          getRowKey={(p) => p.id}
          empty={<EmptyState title={t("sales.empty")} description={t("sales.emptyBody")} />}
        />
      </Panel>
    </>
  );
}
