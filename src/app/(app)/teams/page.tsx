import type { Metadata } from "next";
import { Users } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listTeams, teamQuerySchema, type TeamRow } from "@/domain/teams";
import { getLookups, refName } from "@/domain/lookups";
import { PageHeader, Panel, DataTable, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { BrandChip, UserChip } from "@/components/entity-chips";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("teams.view");
  if (denied) return <AccessDenied locale={locale} />;

  const sp = await searchParams;
  const query = teamQuerySchema.parse(sp);
  const { rows, total } = await listTeams(principal, query);
  const lookups = await getLookups();

  const brandOptions = [...lookups.brands.values()].map((b) => ({ value: b.id, label: b.name }));

  const columns: Column<TeamRow>[] = [
    { key: "name", header: "Team", render: (t) => <span className="font-medium text-ink">{t.name}</span> },
    {
      key: "brand",
      header: "Brand",
      render: (t) =>
        t.brandId
          ? <BrandChip name={refName(lookups.brands, t.brandId)} color={lookups.brands.get(t.brandId)?.meta} />
          : <span className="text-ink-3">Group-wide</span>,
    },
    { key: "department", header: "Department", render: (t) => <span className="text-ink-2">{t.departmentName ?? "—"}</span> },
    { key: "members", header: "Members", align: "center", render: (t) => <span className="tabular">{t.memberCount}</span> },
    {
      key: "lead",
      header: "Lead",
      render: (t) =>
        t.leadUserId
          ? <UserChip name={refName(lookups.users, t.leadUserId)} color={lookups.users.get(t.leadUserId)?.meta} />
          : <span className="text-ink-3">Unassigned</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Teams"
        description="Cross-functional teams group people by brand and department, and route work and ownership."
        meta={<Badge category="neutral">{total} teams</Badge>}
      />
      <ListToolbar
        placeholder="Search teams…"
        filters={brandOptions.length ? [{ name: "brandId", label: "Brand", options: brandOptions }] : []}
      />
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(t) => t.id}
          empty={
            <div className="text-center">
              <Users className="mx-auto mb-2 h-6 w-6 text-ink-3" />
              <p className="text-[13px] font-medium text-ink">No teams in your scope</p>
              <p className="mt-1 text-xs text-ink-3">Teams for the brands you are assigned to will appear here — create one to group people and assign a lead.</p>
            </div>
          }
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
