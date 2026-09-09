import type { Metadata } from "next";
import { Gem } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listBrands, brandQuerySchema, type BrandRow } from "@/domain/brands";
import { PageHeader, Panel, DataTable, StatusBadge, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { BrandChip } from "@/components/entity-chips";

export const metadata: Metadata = { title: "Brands" };

export default async function BrandsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("brands.view");
  if (denied) return <AccessDenied locale={locale} />;

  const sp = await searchParams;
  const query = brandQuerySchema.parse(sp);
  const { rows, total } = await listBrands(principal, query);

  const columns: Column<BrandRow>[] = [
    { key: "name", header: "Brand", render: (b) => <BrandChip name={b.name} color={b.accentColor} /> },
    { key: "code", header: "Code", render: (b) => <span className="font-mono text-xs text-ink-3">{b.code}</span> },
    { key: "companies", header: "Companies", align: "center", render: (b) => <span className="tabular">{b.companyCount}</span> },
    { key: "markets", header: "Markets", align: "center", render: (b) => <span className="tabular">{b.marketCount}</span> },
    { key: "products", header: "Products", align: "center", render: (b) => <span className="tabular">{b.productCount}</span> },
    { key: "status", header: "Status", render: (b) => <StatusBadge module="generic" status={b.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Brands"
        description="Every brand connects companies, markets, products, campaigns, regulatory and finance."
        meta={<Badge category="neutral">{total} brands</Badge>}
      />
      <ListToolbar
        placeholder="Search brands…"
        filters={[{ name: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] }]}
      />
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(b) => b.id}
          getRowHref={(b) => `/brands/${b.id}`}
          empty={
            <div className="text-center">
              <Gem className="mx-auto mb-2 h-6 w-6 text-ink-3" />
              <p className="text-[13px] font-medium text-ink">No brands in your scope</p>
              <p className="mt-1 text-xs text-ink-3">Brands you are assigned to will appear here.</p>
            </div>
          }
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
