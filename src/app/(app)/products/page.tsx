import type { Metadata } from "next";
import { Package } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listProducts, productQuerySchema, type ProductRow } from "@/domain/products";
import { getLookups, refName } from "@/domain/lookups";
import { PageHeader, Panel, DataTable, StatusBadge, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { BrandChip } from "@/components/entity-chips";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("products.view");
  if (denied) return <AccessDenied locale={locale} />;

  const sp = await searchParams;
  const query = productQuerySchema.parse(sp);
  const { rows, total } = await listProducts(principal, query);
  const lookups = await getLookups();

  const brandOptions = [...lookups.brands.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((b) => ({ value: b.id, label: b.name }));

  const columns: Column<ProductRow>[] = [
    { key: "name", header: "Product", render: (p) => p.name },
    { key: "brand", header: "Brand", render: (p) => <BrandChip name={refName(lookups.brands, p.brandId)} color={lookups.brands.get(p.brandId)?.meta} /> },
    { key: "sku", header: "SKU", render: (p) => <span className="font-mono text-xs text-ink-3">{p.sku}</span> },
    { key: "category", header: "Category", render: (p) => p.category ?? "—" },
    { key: "status", header: "Status", align: "end", render: (p) => <StatusBadge module="generic" status={p.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Products"
        description="The product master — every SKU, its markets, regulatory registrations, campaigns and customer cases in one place."
        meta={<Badge category="neutral">{total} products</Badge>}
      />
      <ListToolbar
        placeholder="Search by name or SKU…"
        filters={[
          { name: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
          { name: "brandId", label: "Brand", options: brandOptions },
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
              <p className="text-[13px] font-medium text-ink">No products in your scope</p>
              <p className="mt-1 text-xs text-ink-3">Products belong to brands. Those for brands you can access will appear here — adjust your filters or create a product from a brand.</p>
            </div>
          }
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
