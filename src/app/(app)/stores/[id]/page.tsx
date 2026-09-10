import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getStore } from "@/domain/stores";
import { getActivity } from "@/domain/mutation";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, DataTable, StatusBadge, Metric, EmptyState } from "@/components/ui";
import { RecordPerformanceButton } from "@/components/stores/performance-entry";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { EntityFiles } from "@/components/files/entity-files";
import { BrandChip, CountryChip } from "@/components/entity-chips";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Store" };

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("stores.view");
  const { t } = await getServerI18n();
  const { id } = await params;
  let store;
  try {
    store = await getStore(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!store) notFound();
  const [lookups, activity] = await Promise.all([getLookups(), getActivity("Store", store.id)]);
  const latest = store.performance[0];
  const canRecord = canAnywhere(principal, "sales.create");
  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : t("common.system"),
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/stores" className="hover:text-ink-2">{t("dp.storesNav")}</Link> / {store.name}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">{store.name}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
            <BrandChip name={refName(lookups.brands, store.brandId)} color={store.brandId ? lookups.brands.get(store.brandId)?.meta : null} />
            <CountryChip name={refName(lookups.countries, store.countryId)} iso2={store.countryId ? lookups.countries.get(store.countryId)?.meta : null} />
            <span className="capitalize">{store.platform}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge module="generic" status={store.status} />
          {canRecord && <RecordPerformanceButton storeId={store.id} currency={store.currency} />}
        </div>
      </div>

      {latest && (
        <Panel className="mb-4">
          <PanelHeader title={t("stf.latestPerf")} description={t("stf.periodFrom", { date: formatDate(latest.periodStart, locale) })} />
          <PanelBody className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            <Metric label={t("stf.grossSales")} value={formatCurrency(latest.sales, store.currency, locale)} />
            <Metric label={t("stf.netSales")} value={formatCurrency(latest.netSales, store.currency, locale)} />
            <Metric label={t("stf.orders")} value={formatNumber(latest.orders, locale)} />
            <Metric label="AOV" value={formatCurrency(latest.aov, store.currency, locale)} />
            <Metric label={t("stf.returns")} value={formatNumber(latest.returns, locale)} />
            <Metric label={t("stf.grossProfit")} value={formatCurrency(latest.grossMargin, store.currency, locale)} category="success" />
            <Metric label={t("stf.netContribution")} value={formatCurrency(latest.netContribution, store.currency, locale)} category={Number(latest.netContribution ?? 0) < 0 ? "critical" : "success"} />
          </PanelBody>
        </Panel>
      )}

      <Panel>
        <PanelHeader title={t("stf.perfHistory")} />
        <DataTable
          columns={[
            { key: "period", header: t("stf.period"), render: (p) => `${formatDate(p.periodStart, locale)}` },
            { key: "type", header: t("common.type"), render: (p) => <span className="capitalize text-ink-3">{p.periodType}</span> },
            { key: "sales", header: t("stf.grossSales"), align: "end", render: (p) => formatCurrency(p.sales, store.currency, locale) },
            { key: "net_sales", header: t("stf.netSales"), align: "end", render: (p) => formatCurrency(p.netSales, store.currency, locale) },
            { key: "orders", header: t("stf.orders"), align: "end", render: (p) => formatNumber(p.orders, locale) },
            { key: "aov", header: "AOV", align: "end", render: (p) => formatCurrency(p.aov, store.currency, locale) },
            { key: "profit", header: t("stf.grossProfit"), align: "end", render: (p) => formatCurrency(p.grossMargin, store.currency, locale) },
            { key: "net", header: t("stf.netContribShort"), align: "end", render: (p) => formatCurrency(p.netContribution, store.currency, locale) },
          ]}
          rows={store.performance}
          getRowKey={(p) => p.id}
          empty={<EmptyState title={t("stf.noPerf")} description={t("stf.noPerfBody")} />}
        />
      </Panel>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EntityFiles principal={principal} entityType="Store" entityId={store.id} scope={{ companyId: store.companyId, brandId: store.brandId, countryId: store.countryId }} />
        <Panel>
          <PanelHeader title={t("dp.activity")} />
          <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty={t("dp.noActivity")} /></PanelBody>
        </Panel>
      </div>
    </>
  );
}
