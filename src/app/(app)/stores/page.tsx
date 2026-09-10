import type { Metadata } from "next";
import type { Store } from "@prisma/client";
import { ShoppingBag } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listStores, storeQuerySchema } from "@/domain/stores";
import { getLookups, refName } from "@/domain/lookups";
import { StatusBadge, EmptyState, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { BrandChip, CountryChip } from "@/components/entity-chips";

export const metadata: Metadata = { title: "Stores" };
import { getServerI18n } from "@/lib/server-i18n";

export default async function StoresPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("stores.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const query = storeQuerySchema.parse(sp);
  const [{ rows, total }, lookups] = await Promise.all([listStores(principal, query), getLookups()]);

  const columns: Column<Store>[] = [
    { key: "name", header: t("stores.col.store"), render: (s) => s.name },
    { key: "brand", header: t("common.brand"), render: (s) => <BrandChip name={refName(lookups.brands, s.brandId)} color={s.brandId ? lookups.brands.get(s.brandId)?.meta : null} /> },
    { key: "country", header: t("common.market"), render: (s) => <CountryChip name={refName(lookups.countries, s.countryId)} iso2={s.countryId ? lookups.countries.get(s.countryId)?.meta : null} /> },
    { key: "platform", header: t("common.platform"), render: (s) => <span className="capitalize">{s.platform}</span> },
    { key: "currency", header: t("common.currency"), render: (s) => <span className="text-ink-3">{s.currency}</span> },
    { key: "status", header: t("common.status"), render: (s) => <StatusBadge module="generic" status={s.status} /> },
  ];

  return (
    <ResourceList title={t("stores.title")} description={t("stores.subtitle")} countLabel={t("stores.count")} savedViewsModule="stores"
      searchPlaceholder={t("stores.searchPlaceholder")}
      filters={[{ name: "platform", label: t("common.platform"), options: ["shopify", "woocommerce", "zid", "salla", "amazon", "custom"].map((v) => ({ value: v, label: v })) }]}
      columns={columns} rows={rows} getRowKey={(s) => s.id} getRowHref={(s) => `/stores/${s.id}`}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<ShoppingBag className="h-5 w-5" />} title={t("stores.empty")} description="Connect stores and enter performance to analyze campaign → store → margin." />} />
  );
}
