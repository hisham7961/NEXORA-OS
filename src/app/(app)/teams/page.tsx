import type { Metadata } from "next";
import { Users } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listTeams, teamQuerySchema, type TeamRow } from "@/domain/teams";
import { getLookups, refName } from "@/domain/lookups";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, DataTable, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { BrandChip, UserChip } from "@/components/entity-chips";
import { TeamForm, DepartmentForm } from "@/components/org/org-forms";

export const metadata: Metadata = { title: "Teams" };
import { getServerI18n } from "@/lib/server-i18n";

export default async function TeamsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("teams.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();

  const sp = await searchParams;
  const query = teamQuerySchema.parse(sp);
  const { rows, total } = await listTeams(principal, query);
  const canCreate = canAnywhere(principal, "teams.create");
  const [lookups, departments] = await Promise.all([getLookups(), prisma.department.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  const brandOpts = [...lookups.brands.values()].sort((a, b) => a.name.localeCompare(b.name)).map((b) => ({ id: b.id, label: b.name }));
  const userOpts = [...lookups.users.values()].sort((a, b) => a.name.localeCompare(b.name)).map((u) => ({ id: u.id, label: u.name }));
  const companyOpts = [...lookups.companies.values()].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, label: c.name }));
  const deptOpts = departments.map((d) => ({ id: d.id, label: d.name }));

  const brandOptions = [...lookups.brands.values()].map((b) => ({ value: b.id, label: b.name }));

  const columns: Column<TeamRow>[] = [
    { key: "name", header: t("teams.col.team"), render: (t) => <span className="font-medium text-ink">{t.name}</span> },
    {
      key: "brand",
      header: t("common.brand"),
      render: (row) =>
        row.brandId
          ? <BrandChip name={refName(lookups.brands, row.brandId)} color={lookups.brands.get(row.brandId)?.meta} />
          : <span className="text-ink-3">{t("teams.groupWide")}</span>,
    },
    { key: "department", header: t("common.department"), render: (t) => <span className="text-ink-2">{t.departmentName ?? "—"}</span> },
    { key: "members", header: t("common.members"), align: "center", render: (t) => <span className="tabular">{t.memberCount}</span> },
    {
      key: "lead",
      header: t("teams.col.lead"),
      render: (row) =>
        row.leadUserId
          ? <UserChip name={refName(lookups.users, row.leadUserId)} color={lookups.users.get(row.leadUserId)?.meta} />
          : <span className="text-ink-3">{t("common.unassigned")}</span>,
    },
    ...(canCreate ? [{ key: "edit", header: "", align: "end" as const, render: (t: TeamRow) => <TeamForm mode="edit" brands={brandOpts} departments={deptOpts} users={userOpts} defaults={{ id: t.id, name: t.name, brandId: t.brandId, departmentId: t.departmentId, leadUserId: t.leadUserId }} /> }] : []),
  ];

  return (
    <>
      <PageHeader
        title={t("teams.title")}
        description={t("teams.subtitle")}
        meta={<Badge category="neutral">{total} teams</Badge>}
        actions={canCreate ? <div className="flex items-center gap-2"><DepartmentForm mode="create" companies={companyOpts} /><TeamForm mode="create" brands={brandOpts} departments={deptOpts} users={userOpts} /></div> : undefined}
      />
      <ListToolbar
        placeholder={t("teams.searchPlaceholder")}
        savedViewsModule="teams"
        filters={brandOptions.length ? [{ name: "brandId", label: t("common.brand"), options: brandOptions }] : []}
      />
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(t) => t.id}
          empty={
            <div className="text-center">
              <Users className="mx-auto mb-2 h-6 w-6 text-ink-3" />
              <p className="text-[13px] font-medium text-ink">{t("teams.empty")}</p>
              <p className="mt-1 text-xs text-ink-3">Teams for the brands you are assigned to will appear here — create one to group people and assign a lead.</p>
            </div>
          }
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
