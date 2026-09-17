import type { Metadata } from "next";
import { Gem } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listBrands, brandQuerySchema, type BrandRow } from "@/domain/brands";
import { getLookups } from "@/domain/lookups";
import { PageHeader, Panel, DataTable, StatusBadge, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { BrandChip } from "@/components/entity-chips";
import { BrandForm } from "@/components/org/org-forms";

export const metadata: Metadata = { title: "Brands" };
import { getServerI18n } from "@/lib/server-i18n";

export default async function BrandsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("brands.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();

  const sp = await searchParams;
  const query = brandQuerySchema.parse(sp);
  const { rows, total } = await listBrands(principal, query);
  const canCreate = canAnywhere(principal, "brands.create");
  const lookups = await getLookups();
  const companyOptions = [...lookups.companies.values()].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, label: c.name }));

  const columns: Column<BrandRow>[] = [
    { key: "name", header: t("common.brand"), render: (b) => <BrandChip name={b.name} color={b.accentColor} /> },
    { key: "code", header: t("common.code"), render: (b) => <span className="font-mono text-xs text-ink-3">{b.code}</span> },
    { key: "companies", header: t("brands.col.companies"), align: "center", render: (b) => <span className="tabular">{b.companyCount}</span> },
    { key: "markets", header: t("brands.col.markets"), align: "center", render: (b) => <span className="tabular">{b.marketCount}</span> },
    { key: "products", header: t("brands.col.products"), align: "center", render: (b) => <span className="tabular">{b.productCount}</span> },
    { key: "status", header: t("common.status"), render: (b) => <StatusBadge module="generic" status={b.status} /> },
  ];

  return (
    <>
      <PageHeader
        title={t("brands.title")}
        description={t("brands.subtitle")}
        meta={<Badge category="neutral">{total} brands</Badge>}
        actions={canCreate ? <BrandForm mode="create" companies={companyOptions} /> : undefined}
      />
      <ListToolbar
        placeholder={t("brands.searchPlaceholder")}
        filters={[{ name: "status", label: t("common.status"), options: [{ value: "active", label: t("status.active") }, { value: "inactive", label: t("status.inactive") }] }]}
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
              <p className="text-[13px] font-medium text-ink">{t("brands.empty")}</p>
              <p className="mt-1 text-xs text-ink-3">{t("brands.emptyAssigned")}</p>
            </div>
          }
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
