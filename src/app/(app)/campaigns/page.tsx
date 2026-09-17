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
import { getServerI18n } from "@/lib/server-i18n";

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

  const { t } = await getServerI18n();
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
    { key: "name", header: t("campaigns.col.campaign"), render: (c) => c.name },
    { key: "brand", header: t("common.brand"), render: (c) => <BrandChip name={refName(lookups.brands, c.brandId)} color={lookups.brands.get(c.brandId ?? "")?.meta} /> },
    { key: "market", header: t("common.market"), render: (c) => <CountryChip name={refName(lookups.countries, c.countryId)} iso2={lookups.countries.get(c.countryId ?? "")?.meta} /> },
    { key: "type", header: t("common.type"), render: (c) => <span className="capitalize">{c.type}</span> },
    { key: "planned", header: t("campaigns.col.plannedBudget"), align: "end", render: (c) => formatCurrency(c.plannedBudget, c.currency, locale) },
    { key: "spend", header: t("campaigns.col.actualSpend"), align: "end", render: (c) => formatCurrency(c.actualSpend, c.currency, locale) },
    { key: "status", header: t("common.status"), render: (c) => <StatusBadge module="campaign" status={c.status} /> },
  ];

  return (
    <>
      <PageHeader
        title={t("campaigns.title")}
        description={t("campaigns.subtitle")}
        meta={<Badge category="neutral">{t("campaigns.count", { n: total })}</Badge>}
        actions={canCreate && options ? <CampaignDrawerForm mode="create" options={{ brands: options.brands, countries: options.countries, companies: options.companies, users: options.users }} /> : undefined}
      />
      <ListToolbar
        placeholder={t("campaigns.searchPlaceholder")}
        filters={[
          { name: "status", label: t("common.status"), options: STATUS_OPTIONS.map((s) => ({ value: s, label: t(`status.${s}`) })) },
          { name: "brandId", label: t("common.brand"), options: brandOptions },
          { name: "type", label: t("common.type"), options: TYPE_OPTIONS.map((ty) => ({ value: ty, label: humanize(ty) })) },
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
              <p className="text-[13px] font-medium text-ink">{t("campaigns.empty")}</p>
              <p className="mt-1 text-xs text-ink-3">{t("campaigns.emptyBody")}</p>
            </div>
          }
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
