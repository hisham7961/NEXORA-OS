import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { getSalesOverview } from "@/domain/stores";
import { PageHeader, Panel, PanelHeader, PanelBody, DataTable, Metric, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Sales" };

export default async function SalesPage() {
  const { principal, locale, denied } = await pageGuard("sales.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { storeCount, totals, rows } = await getSalesOverview(principal);

  return (
    <>
      <PageHeader title="Sales" description={`Aggregated performance across ${storeCount} store${storeCount === 1 ? "" : "s"} in your scope.`} />
      <Panel className="mb-4">
        <PanelBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Sales" value={formatCurrency(totals.sales, "KWD", locale)} />
          <Metric label="Orders" value={formatNumber(totals.orders, locale)} />
          <Metric label="Returns" value={formatNumber(totals.returns, locale)} category={totals.returns > 0 ? "warning" : "neutral"} />
          <Metric label="Gross margin" value={formatCurrency(totals.margin, "KWD", locale)} category="success" />
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader title="Recent performance entries" />
        <DataTable
          columns={[
            { key: "store", header: "Store", render: (p) => p.storeName },
            { key: "period", header: "Period", render: (p) => formatDate(p.periodStart, locale) },
            { key: "sales", header: "Sales", align: "end", render: (p) => formatCurrency(p.sales, "KWD", locale) },
            { key: "orders", header: "Orders", align: "end", render: (p) => formatNumber(p.orders, locale) },
            { key: "margin", header: "Margin", align: "end", render: (p) => formatCurrency(p.grossMargin, "KWD", locale) },
          ]}
          rows={rows}
          getRowKey={(p) => p.id}
          empty={<EmptyState title="No sales data" description="Store performance entries will roll up here for cross-store analysis." />}
        />
      </Panel>
    </>
  );
}
