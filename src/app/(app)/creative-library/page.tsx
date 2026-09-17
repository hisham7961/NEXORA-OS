import type { Metadata } from "next";
import type { CreativeAsset } from "@prisma/client";
import { Images } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listCreativeAssets, creativeQuerySchema } from "@/domain/creative";
import { getLookups, refName } from "@/domain/lookups";
import { EmptyState, Badge, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { BrandChip, UserChip } from "@/components/entity-chips";
import { formatDate } from "@/lib/format";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Creative Library" };

export default async function CreativeLibraryPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("creative_library.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const query = creativeQuerySchema.parse(sp);
  const [{ rows, total }, lookups] = await Promise.all([listCreativeAssets(principal, query), getLookups()]);

  const columns: Column<CreativeAsset>[] = [
    { key: "asset", header: t("cl.asset"), render: (a) => <span className="capitalize">{a.assetType ?? "—"}</span> },
    { key: "brand", header: t("common.brand"), render: (a) => <BrandChip name={refName(lookups.brands, a.brandId)} color={a.brandId ? lookups.brands.get(a.brandId)?.meta : null} /> },
    { key: "platform", header: t("common.platform"), render: (a) => a.platform ?? "—" },
    { key: "designer", header: t("cl.designer"), render: (a) => <UserChip name={refName(lookups.users, a.designerId)} color={a.designerId ? lookups.users.get(a.designerId)?.meta : null} /> },
    { key: "approved", header: t("status.approved"), align: "end", render: (a) => (a.approvedAt ? <Badge category="success">{formatDate(a.approvedAt, locale)}</Badge> : <span className="text-ink-3">—</span>) },
  ];

  return (
    <ResourceList title={t("cl.title")} description={t("cl.subtitle")} countLabel={t("cl.countLabel")}
      searchPlaceholder={t("cl.searchPlaceholder")} columns={columns} rows={rows} getRowKey={(a) => a.id}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<Images className="h-5 w-5" />} title={t("cl.empty")} description={t("cl.emptyBody")} />} />
  );
}
