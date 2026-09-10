import type { Metadata } from "next";
import { Globe2 } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listMarkets, marketQuerySchema, type MarketRow } from "@/domain/markets";
import { PageHeader, Panel, DataTable, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { CountryChip } from "@/components/entity-chips";
import { CountryForm } from "@/components/org/org-forms";

export const metadata: Metadata = { title: "Markets" };
import { getServerI18n } from "@/lib/server-i18n";

export default async function MarketsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("markets.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();

  const sp = await searchParams;
  const query = marketQuerySchema.parse(sp);
  const { rows, total } = await listMarkets(query);
  const canCreate = canAnywhere(principal, "markets.create");

  const columns: Column<MarketRow>[] = [
    { key: "name", header: t("common.market"), render: (c) => <CountryChip name={c.name} iso2={c.iso2} /> },
    { key: "iso2", header: t("markets.col.iso"), render: (c) => <span className="font-mono text-xs text-ink-3">{c.iso2}</span> },
    { key: "currency", header: t("common.currency"), render: (c) => <span className="font-mono text-xs">{c.currency}</span> },
    { key: "region", header: t("common.region"), render: (c) => c.region ?? "—" },
    { key: "brands", header: t("markets.col.activeBrands"), align: "center", render: (c) => <span className="tabular">{c.brandCount}</span> },
    { key: "status", header: t("common.status"), align: "end", render: (c) => <Badge category={c.isActive ? "success" : "neutral"}>{c.isActive ? t("markets.active") : t("markets.inactive")}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title={t("markets.title")}
        description={t("markets.subtitle")}
        meta={<Badge category="neutral">{total} markets</Badge>}
        actions={canCreate ? <CountryForm mode="create" /> : undefined}
      />
      <ListToolbar placeholder={t("markets.searchPlaceholder")} />
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(c) => c.id}
          getRowHref={(c) => `/markets/${c.id}`}
          empty={
            <div className="text-center">
              <Globe2 className="mx-auto mb-2 h-6 w-6 text-ink-3" />
              <p className="text-[13px] font-medium text-ink">{t("markets.empty")}</p>
              <p className="mt-1 text-xs text-ink-3">Countries are global master data. Adjust your search, or add markets in Organization settings.</p>
            </div>
          }
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
