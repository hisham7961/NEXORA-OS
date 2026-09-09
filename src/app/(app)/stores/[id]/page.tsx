import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { ForbiddenError } from "@/lib/permissions/engine";
import { getStore } from "@/domain/stores";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, DataTable, StatusBadge, Metric, EmptyState } from "@/components/ui";
import { BrandChip, CountryChip } from "@/components/entity-chips";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Store" };

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("stores.view");
  const { id } = await params;
  let store;
  try {
    store = await getStore(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!store) notFound();
  const lookups = await getLookups();
  const latest = store.performance[0];

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/stores" className="hover:text-ink-2">Stores</Link> / {store.name}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">{store.name}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
            <BrandChip name={refName(lookups.brands, store.brandId)} color={store.brandId ? lookups.brands.get(store.brandId)?.meta : null} />
            <CountryChip name={refName(lookups.countries, store.countryId)} iso2={store.countryId ? lookups.countries.get(store.countryId)?.meta : null} />
            <span className="capitalize">{store.platform}</span>
          </div>
        </div>
        <StatusBadge module="generic" status={store.status} />
      </div>

      {latest && (
        <Panel className="mb-4">
          <PanelHeader title="Latest performance" description={`Period from ${formatDate(latest.periodStart, locale)}`} />
          <PanelBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Sales" value={formatCurrency(latest.sales, store.currency, locale)} />
            <Metric label="Orders" value={formatNumber(latest.orders, locale)} />
            <Metric label="Returns" value={formatNumber(latest.returns, locale)} />
            <Metric label="Gross margin" value={formatCurrency(latest.grossMargin, store.currency, locale)} category="success" />
          </PanelBody>
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Performance history" />
        <DataTable
          columns={[
            { key: "period", header: "Period", render: (p) => `${formatDate(p.periodStart, locale)}` },
            { key: "type", header: "Type", render: (p) => <span className="capitalize text-ink-3">{p.periodType}</span> },
            { key: "sales", header: "Sales", align: "end", render: (p) => formatCurrency(p.sales, store.currency, locale) },
            { key: "orders", header: "Orders", align: "end", render: (p) => formatNumber(p.orders, locale) },
            { key: "margin", header: "Margin", align: "end", render: (p) => formatCurrency(p.grossMargin, store.currency, locale) },
          ]}
          rows={store.performance}
          getRowKey={(p) => p.id}
          empty={<EmptyState title="No performance entered" description="Enter daily/weekly/monthly performance to track sales and margin." />}
        />
      </Panel>
    </>
  );
}
