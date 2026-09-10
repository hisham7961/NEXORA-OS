import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getCampaign } from "@/domain/campaigns";
import { getServerI18n } from "@/lib/server-i18n";
import { getActivity } from "@/domain/mutation";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, DataTable, StatusBadge, Badge, TabBar, EmptyState, Metric, type Column, type TabItem } from "@/components/ui";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { CampaignDrawerForm } from "@/components/campaigns/campaign-drawer-form";
import { CampaignStatusBar, AddMetricButton, DeleteMetricButton } from "@/components/campaigns/campaign-actions";
import { EntityFiles } from "@/components/files/entity-files";
import { BrandChip, CountryChip, UserChip } from "@/components/entity-chips";
import { formatDate, formatCurrency, formatNumber } from "@/lib/format";

function isoDate(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { principal, locale } = await pageGuard("campaigns.view");
  const { t } = await getServerI18n();
  const { id } = await params;
  const tab = (await searchParams).tab ?? "overview";

  let data;
  try {
    data = await getCampaign(principal, id);
  } catch (err) {
    if (err instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw err;
  }
  if (!data) notFound();

  const { campaign, campaignProducts, metrics, reports, tasks } = data;
  const canEdit = canAnywhere(principal, "campaigns.edit");
  const [lookups, activity, options] = await Promise.all([
    getLookups(),
    getActivity("Campaign", id),
    canEdit ? getScopedOptions(principal, "campaigns.edit") : Promise.resolve(null),
  ]);
  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : t("common.system"),
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));

  const planned = Number(campaign.plannedBudget ?? 0);
  const spend = Number(campaign.actualSpend ?? 0);
  const remaining = planned - spend;
  const pctSpent = planned > 0 ? Math.round((spend / planned) * 100) : null;

  const tabs: TabItem[] = [
    { key: "overview", label: t("detail.tab.overview") },
    { key: "metrics", label: t("detail.tab.metrics"), count: metrics.length },
    { key: "products", label: t("detail.tab.products"), count: campaignProducts.length },
    { key: "reports", label: t("detail.tab.reports"), count: reports.length },
    { key: "tasks", label: t("detail.tab.tasks"), count: tasks.length },
    { key: "activity", label: t("detail.tab.activity") },
  ];

  return (
    <>
      {/* 360 header (§44) */}
      <div className="mb-1 text-xs text-ink-3">
        <Link href="/campaigns" className="hover:text-ink-2">{t("detail.tab.campaigns")}</Link> <span className="mx-1">/</span> {campaign.name}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: lookups.brands.get(campaign.brandId ?? "")?.meta ?? "var(--accent)" }}>
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">{campaign.name}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
              <span className="capitalize">{campaign.type}</span>
              <StatusBadge module="campaign" status={campaign.status} />
              <span>·</span>
              <BrandChip name={refName(lookups.brands, campaign.brandId)} color={lookups.brands.get(campaign.brandId ?? "")?.meta} />
              <span>·</span>
              <CountryChip name={refName(lookups.countries, campaign.countryId)} iso2={lookups.countries.get(campaign.countryId ?? "")?.meta} />
            </div>
          </div>
        </div>
        {canEdit && options && (
          <CampaignDrawerForm
            mode="edit"
            options={{ brands: options.brands, countries: options.countries, companies: options.companies, users: options.users }}
            defaults={{
              id: campaign.id, name: campaign.name, type: campaign.type, objective: campaign.objective,
              ownerId: campaign.ownerId, currency: campaign.currency,
              plannedBudget: campaign.plannedBudget != null ? String(campaign.plannedBudget) : "",
              targetAudience: campaign.targetAudience, notes: campaign.notes,
              startDate: isoDate(campaign.startDate), endDate: isoDate(campaign.endDate),
            }}
          />
        )}
      </div>

      <TabBar tabs={tabs} current={tab} className="mb-4" />

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <PanelHeader title={t("camp.brief")} description={t("camp.briefSub")} />
            <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
              <Field label={t("camp.objective")} value={campaign.objective ?? "—"} />
              <Field label={t("common.type")} value={<span className="capitalize">{campaign.type}</span>} />
              <Field label={t("common.brand")} value={<BrandChip name={refName(lookups.brands, campaign.brandId)} color={lookups.brands.get(campaign.brandId ?? "")?.meta} />} />
              <Field label={t("common.market")} value={<CountryChip name={refName(lookups.countries, campaign.countryId)} iso2={lookups.countries.get(campaign.countryId ?? "")?.meta} />} />
              <Field label={t("camp.owner")} value={campaign.ownerId ? <UserChip name={refName(lookups.users, campaign.ownerId)} color={lookups.users.get(campaign.ownerId)?.meta} /> : "—"} />
              <Field label={t("common.currency")} value={<span className="font-mono">{campaign.currency}</span>} />
              <Field label={t("camp.start")} value={formatDate(campaign.startDate, locale)} />
              <Field label={t("camp.end")} value={formatDate(campaign.endDate, locale)} />
              <Field label={t("camp.targetAudience")} value={campaign.targetAudience ?? "—"} />
              <Field label={t("common.status")} value={<StatusBadge module="campaign" status={campaign.status} />} />
            </dl>
            {campaign.notes && (
              <PanelBody className="border-t border-line">
                <p className="text-xs text-ink-3">{t("camp.notes")}</p>
                <p className="mt-1 text-[13px] text-ink whitespace-pre-line">{campaign.notes}</p>
              </PanelBody>
            )}
          </Panel>
          <Panel>
            <PanelHeader title={t("camp.budgetVsSpend")} description={t("camp.budgetVsSpendSub")} />
            <PanelBody>
              <div className="grid grid-cols-2 gap-4">
                <Metric label={t("camp.plannedBudget")} value={formatCurrency(campaign.plannedBudget, campaign.currency, locale)} />
                <Metric label={t("camp.actualSpend")} value={formatCurrency(campaign.actualSpend, campaign.currency, locale)} />
                <Metric
                  label={remaining < 0 ? t("camp.overBudget") : t("camp.remaining")}
                  value={formatCurrency(Math.abs(remaining), campaign.currency, locale)}
                  category={remaining < 0 ? "critical" : "success"}
                />
                <Metric
                  label={t("camp.budgetUsed")}
                  value={pctSpent === null ? "—" : `${pctSpent}%`}
                  category={pctSpent !== null && pctSpent > 100 ? "critical" : pctSpent !== null && pctSpent > 85 ? "warning" : "neutral"}
                />
              </div>
            </PanelBody>
          </Panel>
          {canEdit && (
            <Panel className="lg:col-span-3">
              <PanelHeader title={t("camp.actions")} description={t("camp.actionsSub")} />
              <PanelBody><CampaignStatusBar campaignId={campaign.id} status={campaign.status} /></PanelBody>
            </Panel>
          )}
          <div className="lg:col-span-3">
            <EntityFiles principal={principal} entityType="Campaign" entityId={campaign.id} scope={{ companyId: campaign.companyId, brandId: campaign.brandId, countryId: campaign.countryId }} />
          </div>
        </div>
      )}

      {tab === "metrics" && (
        <Panel>
          <PanelHeader
            title={t("camp.performanceMetrics")}
            description={t("camp.performanceMetricsSub")}
            action={canEdit ? <AddMetricButton campaignId={campaign.id} /> : undefined}
          />
          <DataTable
            columns={[
              { key: "name", header: t("camp.metric"), render: (m) => <span className="capitalize">{m.name}</span> },
              { key: "value", header: t("camp.value"), align: "end", render: (m) => <span className="font-medium">{formatNumber(m.value, locale)}</span> },
              { key: "unit", header: t("camp.unit"), render: (m) => m.unit ?? "—" },
              { key: "kind", header: t("camp.kind"), render: (m) => (m.isTarget ? <Badge category="info">{t("camp.target")}</Badge> : <span className="text-ink-3">{t("camp.actual")}</span>) },
              { key: "date", header: t("common.date"), align: "end", render: (m) => formatDate(m.date, locale) },
              ...(canEdit ? [{ key: "del", header: "", align: "end" as const, render: (m: (typeof metrics)[number]) => <DeleteMetricButton campaignId={campaign.id} metricId={m.id} /> }] : []),
            ] as Column<(typeof metrics)[number]>[]}
            rows={metrics}
            getRowKey={(m) => m.id}
            empty={<EmptyState title={t("camp.noMetrics")} description={t("camp.noMetricsBody")} />}
          />
        </Panel>
      )}

      {tab === "products" && (
        <Panel>
          <DataTable
            columns={[
              { key: "name", header: t("detail.product"), render: (cp) => refName(lookups.products, cp.productId) },
              { key: "sku", header: "SKU", align: "end", render: (cp) => <span className="font-mono text-xs text-ink-3">{lookups.products.get(cp.productId)?.meta ?? "—"}</span> },
            ] as Column<(typeof campaignProducts)[number]>[]}
            rows={campaignProducts}
            getRowKey={(cp) => cp.id}
            getRowHref={(cp) => `/products/${cp.productId}`}
            empty={<EmptyState title={t("camp.noProductsLinked")} description={t("camp.noProductsLinkedBody")} />}
          />
        </Panel>
      )}

      {tab === "reports" && (
        <Panel>
          <DataTable
            columns={[
              { key: "date", header: t("common.date"), render: (r) => formatDate(r.date, locale) },
              { key: "summary", header: t("detail.summary"), render: (r) => <span className="text-ink-2">{r.summary ?? "—"}</span> },
              { key: "author", header: t("camp.author"), align: "end", render: (r) => (r.authorId ? <UserChip name={refName(lookups.users, r.authorId)} color={lookups.users.get(r.authorId)?.meta} /> : "—") },
            ] as Column<(typeof reports)[number]>[]}
            rows={reports}
            getRowKey={(r) => r.id}
            empty={<EmptyState title={t("camp.noReports")} description={t("camp.noReportsBody")} />}
          />
        </Panel>
      )}

      {tab === "tasks" && (
        <Panel>
          <DataTable
            columns={[
              { key: "title", header: t("detail.task"), render: (t) => t.title },
              { key: "priority", header: t("common.priority"), render: (t) => <span className="capitalize">{t.priority}</span> },
              { key: "owner", header: t("camp.owner"), render: (t) => (t.ownerId ? <UserChip name={refName(lookups.users, t.ownerId)} color={lookups.users.get(t.ownerId)?.meta} /> : "—") },
              { key: "due", header: t("common.due"), render: (t) => formatDate(t.dueDate, locale) },
              { key: "status", header: t("common.status"), align: "end", render: (t) => <StatusBadge module="task" status={t.status} /> },
            ] as Column<(typeof tasks)[number]>[]}
            rows={tasks}
            getRowKey={(t) => t.id}
            empty={<EmptyState title={t("camp.noRelatedTasks")} description={t("camp.noRelatedTasksBody")} />}
          />
        </Panel>
      )}

      {tab === "activity" && (
        <Panel>
          <PanelHeader title={t("detail.tab.activity")} description={t("camp.activitySub")} />
          <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty={t("camp.noActivity")} /></PanelBody>
        </Panel>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-1 text-[13px] text-ink">{value}</dd>
    </div>
  );
}
