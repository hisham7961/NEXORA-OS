import type { Metadata } from "next";
import { Globe2 } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listMarkets, marketQuerySchema, type MarketRow } from "@/domain/markets";
import { PageHeader, Panel, DataTable, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { CountryChip } from "@/components/entity-chips";

export const metadata: Metadata = { title: "Markets" };

export default async function MarketsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { locale, denied } = await pageGuard("markets.view");
  if (denied) return <AccessDenied locale={locale} />;

  const sp = await searchParams;
  const query = marketQuerySchema.parse(sp);
  const { rows, total } = await listMarkets(query);

  const columns: Column<MarketRow>[] = [
    { key: "name", header: "Market", render: (c) => <CountryChip name={c.name} iso2={c.iso2} /> },
    { key: "iso2", header: "ISO", render: (c) => <span className="font-mono text-xs text-ink-3">{c.iso2}</span> },
    { key: "currency", header: "Currency", render: (c) => <span className="font-mono text-xs">{c.currency}</span> },
    { key: "region", header: "Region", render: (c) => c.region ?? "—" },
    { key: "brands", header: "Active brands", align: "center", render: (c) => <span className="tabular">{c.brandCount}</span> },
    { key: "status", header: "Status", align: "end", render: (c) => <Badge category={c.isActive ? "success" : "neutral"}>{c.isActive ? "Active" : "Inactive"}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="Markets"
        description="The countries the group operates in — each drives its own currency, registrations and document rules."
        meta={<Badge category="neutral">{total} markets</Badge>}
      />
      <ListToolbar placeholder="Search by country or ISO code…" />
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(c) => c.id}
          getRowHref={(c) => `/markets/${c.id}`}
          empty={
            <div className="text-center">
              <Globe2 className="mx-auto mb-2 h-6 w-6 text-ink-3" />
              <p className="text-[13px] font-medium text-ink">No markets found</p>
              <p className="mt-1 text-xs text-ink-3">Countries are global master data. Adjust your search, or add markets in Organization settings.</p>
            </div>
          }
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
