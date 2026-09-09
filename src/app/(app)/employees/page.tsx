import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listEmployees, employeeQuerySchema, type EmployeeRow } from "@/domain/employees";
import { getLookups, refName } from "@/domain/lookups";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, DataTable, StatusBadge, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { UserChip } from "@/components/entity-chips";
import { EmployeeForm } from "@/components/org/org-forms";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("employees.view");
  if (denied) return <AccessDenied locale={locale} />;

  const sp = await searchParams;
  const query = employeeQuerySchema.parse(sp);
  const { rows, total } = await listEmployees(principal, query);
  const canCreate = canAnywhere(principal, "employees.create");
  const [lookups, departments, teams, unlinkedUsers] = await Promise.all([
    getLookups(),
    prisma.department.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.team.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { archivedAt: null, employee: { is: null } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const companyOpts = [...lookups.companies.values()].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, label: c.name }));
  const deptOpts = departments.map((d) => ({ id: d.id, label: d.name }));
  const teamOpts = teams.map((t) => ({ id: t.id, label: t.name }));
  const userOpts = unlinkedUsers.map((u) => ({ id: u.id, label: u.name }));

  const columns: Column<EmployeeRow>[] = [
    { key: "name", header: "Employee", render: (e) => <UserChip name={e.name} color={e.avatarColor} /> },
    { key: "position", header: "Position", render: (e) => <span className="text-ink-2">{e.position ?? "—"}</span> },
    { key: "company", header: "Company", render: (e) => <span className="text-ink-2">{refName(lookups.companies, e.companyId)}</span> },
    { key: "department", header: "Department", render: (e) => <span className="text-ink-2">{e.departmentName ?? "—"}</span> },
    { key: "status", header: "Status", align: "end", render: (e) => <StatusBadge module="generic" status={e.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Employees"
        description="Everyone in the group — their company, department, brand and market assignments, and workload."
        meta={<Badge category="neutral">{total} people</Badge>}
        actions={canCreate ? <EmployeeForm mode="create" users={userOpts} companies={companyOpts} departments={deptOpts} teams={teamOpts} /> : undefined}
      />
      <ListToolbar
        placeholder="Search by name or position…"
        filters={[{
          name: "status",
          label: "Status",
          options: [
            { value: "active", label: "Active" },
            { value: "on_leave", label: "On leave" },
            { value: "suspended", label: "Suspended" },
            { value: "terminated", label: "Terminated" },
          ],
        }]}
      />
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(e) => e.id}
          getRowHref={(e) => `/employees/${e.id}`}
          empty={
            <div className="text-center">
              <UserRound className="mx-auto mb-2 h-6 w-6 text-ink-3" />
              <p className="text-[13px] font-medium text-ink">No employees in your scope</p>
              <p className="mt-1 text-xs text-ink-3">People in the companies you can access will appear here. Adjust filters or ask an administrator to widen your scope.</p>
            </div>
          }
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
