import type { Metadata } from "next";
import { Package } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listProducts, productQuerySchema, type ProductRow } from "@/domain/products";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { PageHeader, Panel, DataTable, StatusBadge, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { BrandChip } from "@/components/entity-chips";
import { ProductForm } from "@/components/products/product-controls";

export const metadata: Metadata = { title: "Products" };
import { getServerI18n } from "@/lib/server-i18n";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("products.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();

  const sp = await searchParams;
  const query = productQuerySchema.parse(sp);
  const { rows, total } = await listProducts(principal, query);
  const canCreate = canAnywhere(principal, "products.create");
  const [lookups, options] = await Promise.all([getLookups(), canCreate ? getScopedOptions(principal, "products.create") : Promise.resolve(null)]);

  const brandOptions = [...lookups.brands.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((b) => ({ value: b.id, label: b.name }));

  const columns: Column<ProductRow>[] = [
    { key: "name", header: t("products.col.product"), render: (p) => p.name },
    { key: "brand", header: t("common.brand"), render: (p) => <BrandChip name={refName(lookups.brands, p.brandId)} color={lookups.brands.get(p.brandId)?.meta} /> },
    { key: "sku", header: t("products.col.sku"), render: (p) => <span className="font-mono text-xs text-ink-3">{p.sku}</span> },
    { key: "category", header: t("common.category"), render: (p) => p.category ?? "—" },
    { key: "status", header: t("common.status"), align: "end", render: (p) => <StatusBadge module="generic" status={p.status} /> },
  ];

  return (
    <>
      <PageHeader
        title={t("products.title")}
        description={t("products.subtitle")}
        meta={<Badge category="neutral">{total} products</Badge>}
        actions={canCreate && options ? <ProductForm mode="create" brands={options.brands} /> : undefined}
      />
      <ListToolbar
        placeholder={t("products.searchPlaceholder")}
        filters={[
          { name: "status", label: t("common.status"), options: [{ value: "active", label: t("status.active") }, { value: "inactive", label: t("status.inactive") }] },
          { name: "brandId", label: t("common.brand"), options: brandOptions },
        ]}
      />
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(p) => p.id}
          getRowHref={(p) => `/products/${p.id}`}
          empty={
            <div className="text-center">
              <Package className="mx-auto mb-2 h-6 w-6 text-ink-3" />
              <p className="text-[13px] font-medium text-ink">{t("products.empty")}</p>
              <p className="mt-1 text-xs text-ink-3">Products belong to brands. Those for brands you can access will appear here — adjust your filters or create a product from a brand.</p>
            </div>
          }
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
