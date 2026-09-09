import type { Metadata } from "next";
import type { Campaign } from "@prisma/client";
import { Megaphone } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listCampaigns, campaignQuerySchema } from "@/domain/campaigns";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { PageHeader, Panel, DataTable, StatusBadge, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { CampaignDrawerForm } from "@/components/campaigns/campaign-drawer-form";
import { BrandChip, CountryChip } from "@/components/entity-chips";
import { formatCurrency } from "@/lib/format";
import { humanize } from "@/lib/status";

export const metadata: Metadata = { title: "Campaigns" };

const STATUS_OPTIONS = [
  "planning", "waiting_creative", "creative_review", "ready", "scheduled",
  "live", "monitoring", "reporting", "completed", "cancelled",
];
const TYPE_OPTIONS = [
  "meta", "instagram", "facebook", "tiktok", "snapchat", "google",
  "influencer", "whatsapp", "email", "offline", "retail", "custom",
];

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("campaigns.view");
  if (denied) return <AccessDenied locale={locale} />;

  const sp = await searchParams;
  const query = campaignQuerySchema.parse(sp);
  const canCreate = canAnywhere(principal, "campaigns.create");
  const [{ rows, total }, lookups, options] = await Promise.all([
    listCampaigns(principal, query),
    getLookups(),
    canCreate ? getScopedOptions(principal, "campaigns.create") : Promise.resolve(null),
  ]);

  const brandOptions = [...lookups.brands.values()].map((b) => ({ value: b.id, label: b.name }));

  const columns: Column<Campaign>[] = [
    { key: "name", header: "Campaign", render: (c) => c.name },
    { key: "brand", header: "Brand", render: (c) => <BrandChip name={refName(lookups.brands, c.brandId)} color={lookups.brands.get(c.brandId ?? "")?.meta} /> },
    { key: "market", header: "Market", render: (c) => <CountryChip name={refName(lookups.countries, c.countryId)} iso2={lookups.countries.get(c.countryId ?? "")?.meta} /> },
    { key: "type", header: "Type", render: (c) => <span className="capitalize">{c.type}</span> },
    { key: "planned", header: "Planned budget", align: "end", render: (c) => formatCurrency(c.plannedBudget, c.currency, locale) },
    { key: "spend", header: "Actual spend", align: "end", render: (c) => formatCurrency(c.actualSpend, c.currency, locale) },
    { key: "status", header: "Status", render: (c) => <StatusBadge module="campaign" status={c.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Every marketing campaign across brands and markets — budget, spend and lifecycle at a glance."
        meta={<Badge category="neutral">{total} campaigns</Badge>}
        actions={canCreate && options ? <CampaignDrawerForm mode="create" options={{ brands: options.brands, countries: options.countries, companies: options.companies, users: options.users }} /> : undefined}
      />
      <ListToolbar
        placeholder="Search campaigns…"
        filters={[
          { name: "status", label: "Status", options: STATUS_OPTIONS.map((s) => ({ value: s, label: humanize(s) })) },
          { name: "brandId", label: "Brand", options: brandOptions },
          { name: "type", label: "Type", options: TYPE_OPTIONS.map((t) => ({ value: t, label: humanize(t) })) },
        ]}
      />
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(c) => c.id}
          getRowHref={(c) => `/campaigns/${c.id}`}
          empty={
            <div className="text-center">
              <Megaphone className="mx-auto mb-2 h-6 w-6 text-ink-3" />
              <p className="text-[13px] font-medium text-ink">No campaigns in your scope</p>
              <p className="mt-1 text-xs text-ink-3">Campaigns for the brands and markets you can access will appear here. Adjust the filters or start planning one to see it listed.</p>
            </div>
          }
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
