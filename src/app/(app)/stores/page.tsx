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

export default async function StoresPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("stores.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const query = storeQuerySchema.parse(sp);
  const [{ rows, total }, lookups] = await Promise.all([listStores(principal, query), getLookups()]);

  const columns: Column<Store>[] = [
    { key: "name", header: "Store", render: (s) => s.name },
    { key: "brand", header: "Brand", render: (s) => <BrandChip name={refName(lookups.brands, s.brandId)} color={s.brandId ? lookups.brands.get(s.brandId)?.meta : null} /> },
    { key: "country", header: "Market", render: (s) => <CountryChip name={refName(lookups.countries, s.countryId)} iso2={s.countryId ? lookups.countries.get(s.countryId)?.meta : null} /> },
    { key: "platform", header: "Platform", render: (s) => <span className="capitalize">{s.platform}</span> },
    { key: "currency", header: "Currency", render: (s) => <span className="text-ink-3">{s.currency}</span> },
    { key: "status", header: "Status", render: (s) => <StatusBadge module="generic" status={s.status} /> },
  ];

  return (
    <ResourceList title="Stores" description="E-commerce stores across platforms and markets." countLabel="stores"
      searchPlaceholder="Search stores…"
      filters={[{ name: "platform", label: "Platform", options: ["shopify", "woocommerce", "zid", "salla", "amazon", "custom"].map((v) => ({ value: v, label: v })) }]}
      columns={columns} rows={rows} getRowKey={(s) => s.id} getRowHref={(s) => `/stores/${s.id}`}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<ShoppingBag className="h-5 w-5" />} title="No stores" description="Connect stores and enter performance to analyze campaign → store → margin." />} />
  );
}
