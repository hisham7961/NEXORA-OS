import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getCampaign } from "@/domain/campaigns";
import { getActivity } from "@/domain/mutation";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, DataTable, StatusBadge, Badge, TabBar, EmptyState, Metric, type Column, type TabItem } from "@/components/ui";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { CampaignDrawerForm } from "@/components/campaigns/campaign-drawer-form";
import { CampaignStatusBar, AddMetricButton } from "@/components/campaigns/campaign-actions";
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
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : "System",
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));

  const planned = Number(campaign.plannedBudget ?? 0);
  const spend = Number(campaign.actualSpend ?? 0);
  const remaining = planned - spend;
  const pctSpent = planned > 0 ? Math.round((spend / planned) * 100) : null;

  const tabs: TabItem[] = [
    { key: "overview", label: "Overview" },
    { key: "metrics", label: "Metrics", count: metrics.length },
    { key: "products", label: "Products", count: campaignProducts.length },
    { key: "reports", label: "Reports", count: reports.length },
    { key: "tasks", label: "Tasks", count: tasks.length },
    { key: "activity", label: "Activity" },
  ];

  return (
    <>
      {/* 360 header (§44) */}
      <div className="mb-1 text-xs text-ink-3">
        <Link href="/campaigns" className="hover:text-ink-2">Campaigns</Link> <span className="mx-1">/</span> {campaign.name}
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
              actualSpend: campaign.actualSpend != null ? String(campaign.actualSpend) : "",
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
            <PanelHeader title="Brief" description="Objective, targeting and schedule" />
            <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
              <Field label="Objective" value={campaign.objective ?? "—"} />
              <Field label="Type" value={<span className="capitalize">{campaign.type}</span>} />
              <Field label="Brand" value={<BrandChip name={refName(lookups.brands, campaign.brandId)} color={lookups.brands.get(campaign.brandId ?? "")?.meta} />} />
              <Field label="Market" value={<CountryChip name={refName(lookups.countries, campaign.countryId)} iso2={lookups.countries.get(campaign.countryId ?? "")?.meta} />} />
              <Field label="Owner" value={campaign.ownerId ? <UserChip name={refName(lookups.users, campaign.ownerId)} color={lookups.users.get(campaign.ownerId)?.meta} /> : "—"} />
              <Field label="Currency" value={<span className="font-mono">{campaign.currency}</span>} />
              <Field label="Start" value={formatDate(campaign.startDate, locale)} />
              <Field label="End" value={formatDate(campaign.endDate, locale)} />
              <Field label="Target audience" value={campaign.targetAudience ?? "—"} />
              <Field label="Status" value={<StatusBadge module="campaign" status={campaign.status} />} />
            </dl>
            {campaign.notes && (
              <PanelBody className="border-t border-line">
                <p className="text-xs text-ink-3">Notes</p>
                <p className="mt-1 text-[13px] text-ink whitespace-pre-line">{campaign.notes}</p>
              </PanelBody>
            )}
          </Panel>
          <Panel>
            <PanelHeader title="Budget vs spend" description="Planned budget against actual spend" />
            <PanelBody>
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Planned budget" value={formatCurrency(campaign.plannedBudget, campaign.currency, locale)} />
                <Metric label="Actual spend" value={formatCurrency(campaign.actualSpend, campaign.currency, locale)} />
                <Metric
                  label={remaining < 0 ? "Over budget" : "Remaining"}
                  value={formatCurrency(Math.abs(remaining), campaign.currency, locale)}
                  category={remaining < 0 ? "critical" : "success"}
                />
                <Metric
                  label="Budget used"
                  value={pctSpent === null ? "—" : `${pctSpent}%`}
                  category={pctSpent !== null && pctSpent > 100 ? "critical" : pctSpent !== null && pctSpent > 85 ? "warning" : "neutral"}
                />
              </div>
            </PanelBody>
          </Panel>
          {canEdit && (
            <Panel className="lg:col-span-3">
              <PanelHeader title="Actions" description="Advance the campaign through its lifecycle. Every change is audited." />
              <PanelBody><CampaignStatusBar campaignId={campaign.id} status={campaign.status} /></PanelBody>
            </Panel>
          )}
        </div>
      )}

      {tab === "metrics" && (
        <Panel>
          <PanelHeader
            title="Performance metrics"
            description="Actual results and targets. Spend rolls up into the campaign budget."
            action={canEdit ? <AddMetricButton campaignId={campaign.id} /> : undefined}
          />
          <DataTable
            columns={[
              { key: "name", header: "Metric", render: (m) => <span className="capitalize">{m.name}</span> },
              { key: "value", header: "Value", align: "end", render: (m) => <span className="font-medium">{formatNumber(m.value, locale)}</span> },
              { key: "unit", header: "Unit", render: (m) => m.unit ?? "—" },
              { key: "kind", header: "Kind", render: (m) => (m.isTarget ? <Badge category="info">Target</Badge> : <span className="text-ink-3">Actual</span>) },
              { key: "date", header: "Date", align: "end", render: (m) => formatDate(m.date, locale) },
            ] as Column<(typeof metrics)[number]>[]}
            rows={metrics}
            getRowKey={(m) => m.id}
            empty={<EmptyState title="No metrics recorded" description="Performance metrics for this campaign — spend, impressions, reach, clicks, conversions and targets — will appear here once they are logged." />}
          />
        </Panel>
      )}

      {tab === "products" && (
        <Panel>
          <DataTable
            columns={[
              { key: "name", header: "Product", render: (cp) => refName(lookups.products, cp.productId) },
              { key: "sku", header: "SKU", align: "end", render: (cp) => <span className="font-mono text-xs text-ink-3">{lookups.products.get(cp.productId)?.meta ?? "—"}</span> },
            ] as Column<(typeof campaignProducts)[number]>[]}
            rows={campaignProducts}
            getRowKey={(cp) => cp.id}
            getRowHref={(cp) => `/products/${cp.productId}`}
            empty={<EmptyState title="No products linked" description="Products promoted by this campaign will appear here. Linking products keeps spend and performance tied to the catalog." />}
          />
        </Panel>
      )}

      {tab === "reports" && (
        <Panel>
          <DataTable
            columns={[
              { key: "date", header: "Date", render: (r) => formatDate(r.date, locale) },
              { key: "summary", header: "Summary", render: (r) => <span className="text-ink-2">{r.summary ?? "—"}</span> },
              { key: "author", header: "Author", align: "end", render: (r) => (r.authorId ? <UserChip name={refName(lookups.users, r.authorId)} color={lookups.users.get(r.authorId)?.meta} /> : "—") },
            ] as Column<(typeof reports)[number]>[]}
            rows={reports}
            getRowKey={(r) => r.id}
            empty={<EmptyState title="No reports yet" description="Performance reviews and post-mortems for this campaign will appear here. Reports capture what happened and what to do next." />}
          />
        </Panel>
      )}

      {tab === "tasks" && (
        <Panel>
          <DataTable
            columns={[
              { key: "title", header: "Task", render: (t) => t.title },
              { key: "priority", header: "Priority", render: (t) => <span className="capitalize">{t.priority}</span> },
              { key: "owner", header: "Owner", render: (t) => (t.ownerId ? <UserChip name={refName(lookups.users, t.ownerId)} color={lookups.users.get(t.ownerId)?.meta} /> : "—") },
              { key: "due", header: "Due", render: (t) => formatDate(t.dueDate, locale) },
              { key: "status", header: "Status", align: "end", render: (t) => <StatusBadge module="task" status={t.status} /> },
            ] as Column<(typeof tasks)[number]>[]}
            rows={tasks}
            getRowKey={(t) => t.id}
            empty={<EmptyState title="No related tasks" description="Work items linked to this campaign will appear here, so the team can see everything this campaign depends on in one place." />}
          />
        </Panel>
      )}

      {tab === "activity" && (
        <Panel>
          <PanelHeader title="Activity" description="Every change to this campaign, from the audit trail." />
          <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty="No activity yet." /></PanelBody>
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
