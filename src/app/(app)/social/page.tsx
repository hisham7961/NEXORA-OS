import type { Metadata } from "next";
import type { PublishingItem } from "@prisma/client";
import { Share2 } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listPublishing, getCoverageMatrix, socialQuerySchema } from "@/domain/social";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { PageHeader, Panel, DataTable, StatusBadge, EmptyState, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { CoverageMatrix } from "@/components/social/coverage-matrix";
import { PublishingForm, RecurrenceButton } from "@/components/social/publishing-form";
import { BrandChip, UserChip } from "@/components/entity-chips";
import { formatDateShort } from "@/lib/format";
import { humanize } from "@/lib/status";

export const metadata: Metadata = { title: "Social Publishing" };
import { getServerI18n } from "@/lib/server-i18n";

export default async function SocialPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("social.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const query = socialQuerySchema.parse(sp);
  const canCreate = canAnywhere(principal, "social.create");
  const [{ rows, total }, coverage, lookups, options] = await Promise.all([
    listPublishing(principal, query),
    getCoverageMatrix(principal),
    getLookups(),
    canCreate ? getScopedOptions(principal, "social.create") : Promise.resolve(null),
  ]);

  const columns: Column<PublishingItem>[] = [
    { key: "type", header: t("soc.content"), render: (p) => <span className="capitalize">{p.contentType}</span> },
    { key: "platform", header: t("common.platform"), render: (p) => <span className="capitalize">{p.platform ?? "—"}</span> },
    { key: "brand", header: t("common.brand"), render: (p) => <BrandChip name={refName(lookups.brands, p.brandId)} color={p.brandId ? lookups.brands.get(p.brandId)?.meta : null} /> },
    { key: "date", header: t("social.col.publish"), render: (p) => formatDateShort(p.publishDate, locale) },
    { key: "owner", header: t("common.owner"), render: (p) => <UserChip name={refName(lookups.users, p.ownerId)} color={p.ownerId ? lookups.users.get(p.ownerId)?.meta : null} /> },
    { key: "checks", header: t("social.col.checkpoints"), render: (p) => (
      <span className="flex gap-1">
        <Badge category={p.scheduledConfirmedAt ? "success" : "neutral"}>{t("soc.sched")}</Badge>
        <Badge category={p.publishedConfirmedAt ? "success" : "neutral"}>{t("soc.pub")}</Badge>
      </span>
    ) },
    { key: "status", header: t("common.status"), render: (p) => <StatusBadge module="publishing" status={p.status} /> },
  ];

  return (
    <>
      <PageHeader
        title={t("social.title")}
        description={t("social.subtitle")}
        meta={<Badge>{total} items</Badge>}
        actions={
          canCreate && options ? (
            <div className="flex items-center gap-2">
              <RecurrenceButton options={{ brands: options.brands, countries: options.countries, users: options.users }} />
              <PublishingForm mode="create" options={{ brands: options.brands, countries: options.countries, users: options.users }} />
            </div>
          ) : undefined
        }
      />
      <CoverageMatrix data={coverage} locale={locale} />
      <ListToolbar
        placeholder={t("social.searchPlaceholder")}
        filters={[{ name: "status", label: t("common.status"), options: ["idea", "design", "review", "approved", "scheduled", "published", "failed"].map((v) => ({ value: v, label: t(`status.${v}`) })) }]}
      />
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(p) => p.id}
          getRowHref={(p) => `/social/${p.id}`}
          empty={<EmptyState icon={<Share2 className="h-5 w-5" />} title={t("soc.empty")} description={t("soc.emptyBody")} />}
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
