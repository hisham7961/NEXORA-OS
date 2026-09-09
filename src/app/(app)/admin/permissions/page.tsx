import type { Metadata } from "next";
import { Fragment } from "react";
import { Check, ShieldCheck, UserCheck, KeyRound, Users } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import {
  getPermissionMatrix, describeUserAccess, listSelectableUsers,
  listRolesFull, listAssignments,
} from "@/domain/permissions-admin";
import { getScopedOptions } from "@/domain/options";
import { MODULES } from "@/lib/permissions/catalog";
import { Panel, PanelHeader, PanelBody, PageHeader, TabBar, Badge, Avatar, DataTable, type TabItem } from "@/components/ui";
import { TesterUserPicker } from "@/components/admin/permission-tester";
import { RoleForm } from "@/components/admin/role-form";
import { AssignRoleButton, RemoveAssignmentButton } from "@/components/admin/assign-form";
import { UserChip } from "@/components/entity-chips";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Permissions" };

export default async function PermissionsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("permissions.manage");
  if (denied) return <AccessDenied locale={locale} />;

  const sp = await searchParams;
  const tab = sp.tab ?? "matrix";
  const tabs: TabItem[] = [
    { key: "matrix", label: "Permission Matrix" },
    { key: "roles", label: "Roles" },
    { key: "assignments", label: "Assignments" },
    { key: "tester", label: "Permission Tester" },
  ];

  return (
    <>
      <PageHeader
        title="Permissions"
        description="Roles are configurable bundles of permissions; access is granted within a scope (company · brand · country · department · team). Every change is audited."
      />
      <TabBar tabs={tabs} current={tab} className="mb-4" />
      {tab === "matrix" && <Matrix />}
      {tab === "roles" && <Roles />}
      {tab === "assignments" && <Assignments principal={principal} locale={locale} />}
      {tab === "tester" && <Tester selected={sp.user} />}
    </>
  );
}

async function Roles() {
  const roles = await listRolesFull();
  return (
    <Panel>
      <PanelHeader
        title="Roles"
        icon={<KeyRound className="h-4 w-4" />}
        description="Create and edit reusable permission bundles."
        action={<RoleForm mode="create" />}
      />
      <ul className="divide-y divide-line">
        {roles.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-ink">{r.name}</span>
                <span className="font-mono text-[11px] text-ink-3">{r.key}</span>
                {r.isSystem && <Badge category="neutral">System</Badge>}
              </div>
              <div className="text-xs text-ink-3">{r.permissions.includes("*") ? "All permissions" : `${r.permissions.length} permissions`} · {r.assignments} assignments</div>
            </div>
            {r.key !== "super_admin" && <RoleForm mode="edit" defaults={{ id: r.id, name: r.name, description: r.description, permissions: r.permissions }} />}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

async function Assignments({ principal, locale }: { principal: import("@/lib/permissions/engine").Principal; locale: "en" | "ar" }) {
  const [rows, roles, users, options] = await Promise.all([
    listAssignments(),
    listRolesFull(),
    listSelectableUsers(),
    getScopedOptions(principal, "permissions.manage"),
  ]);
  const roleOptions = roles.map((r) => ({ id: r.id, label: r.name }));
  const userOptions = users.map((u) => ({ id: u.id, label: `${u.name} — ${u.email}` }));

  return (
    <Panel>
      <PanelHeader
        title="Role assignments"
        icon={<Users className="h-4 w-4" />}
        description="Who has which role, in which scope. You can only grant within your own administration scope."
        action={<AssignRoleButton users={userOptions} roles={roleOptions} brands={options.brands} countries={options.countries} companies={options.companies} />}
      />
      <DataTable
        columns={[
          { key: "user", header: "User", render: (a) => <UserChip name={a.userName} color={a.userColor} /> },
          { key: "role", header: "Role", render: (a) => a.roleName },
          { key: "company", header: "Company", render: (a) => a.company },
          { key: "brand", header: "Brand", render: (a) => a.brand },
          { key: "country", header: "Country", render: (a) => a.country },
          { key: "expires", header: "Expires", render: (a) => (a.expiresAt ? formatDate(a.expiresAt, locale) : "—") },
          { key: "remove", header: "", align: "end", render: (a) => <RemoveAssignmentButton assignmentId={a.id} /> },
        ]}
        rows={rows}
        getRowKey={(a) => a.id}
      />
    </Panel>
  );
}

async function Matrix() {
  const { roles, grants } = await getPermissionMatrix();
  return (
    <Panel>
      <PanelHeader title="Role × Permission matrix" icon={<ShieldCheck className="h-4 w-4" />} description="Which role grants which capability. Manage (m) implies the module's standard actions." />
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-2/80 backdrop-blur">
              <th className="sticky start-0 z-20 bg-surface-2/95 px-3 py-2 text-start text-[11px] font-semibold uppercase tracking-wide text-ink-3 min-w-56">Permission</th>
              {roles.map((r) => (
                <th key={r.id} className="px-2 py-2 text-center text-[11px] font-semibold text-ink-2 whitespace-nowrap">{r.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => (
              <Fragment key={m.key}>
                <tr className="bg-surface-2/40">
                  <td colSpan={roles.length + 1} className="sticky start-0 bg-surface-2/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                    {m.group} · {m.label}
                  </td>
                </tr>
                {m.actions.map((action) => {
                  const key = `${m.key}.${action}`;
                  return (
                    <tr key={key} className="border-b border-line hover:bg-surface-2/50">
                      <td className="sticky start-0 z-10 bg-surface px-3 py-1.5 font-mono text-[11.5px] text-ink-2">{key}</td>
                      {roles.map((r) => (
                        <td key={r.id} className="px-2 py-1.5 text-center">
                          {grants(r.id, key) ? (
                            <Check className="mx-auto h-3.5 w-3.5 text-accent" strokeWidth={2.5} />
                          ) : (
                            <span className="mx-auto block h-1 w-1 rounded-full bg-line-strong" />
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

async function Tester({ selected }: { selected?: string }) {
  const users = await listSelectableUsers();
  const result = selected ? await describeUserAccess(selected) : null;

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          title="Permission Tester"
          icon={<UserCheck className="h-4 w-4" />}
          description="Select a user to preview exactly what they can access — computed from the real permission engine."
          action={<TesterUserPicker users={users} current={selected} />}
        />
        {!result ? (
          <PanelBody className="text-[13px] text-ink-3">Choose a user above to see their effective access.</PanelBody>
        ) : (
          <PanelBody className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar name={result.user.name} size={36} />
              <div>
                <div className="text-[14px] font-semibold text-ink">{result.user.name}</div>
                <div className="text-xs text-ink-3">{result.user.email}</div>
              </div>
              {result.user.isSuperAdmin && <Badge category="critical" dot>Super Admin — full access</Badge>}
            </div>

            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Role assignments &amp; scope</div>
              {result.assignments.length === 0 ? (
                <p className="text-[13px] text-ink-3">No role assignments{result.user.isSuperAdmin ? " (super admin bypasses scopes)." : "."}</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-line">
                  <table className="w-full text-[12.5px]">
                    <thead className="bg-surface-2/60">
                      <tr className="text-start text-[11px] uppercase tracking-wide text-ink-3">
                        <th className="px-3 py-2 text-start">Role</th>
                        <th className="px-3 py-2 text-start">Company</th>
                        <th className="px-3 py-2 text-start">Brand</th>
                        <th className="px-3 py-2 text-start">Country</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.assignments.map((a, i) => (
                        <tr key={i} className="border-t border-line">
                          <td className="px-3 py-2 font-medium text-ink">{a.roleName}</td>
                          <td className="px-3 py-2 text-ink-2">{a.company}</td>
                          <td className="px-3 py-2 text-ink-2">{a.brand}</td>
                          <td className="px-3 py-2 text-ink-2">{a.country}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">What can this user do? (within the scopes above)</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {result.capabilities.filter((c) => c.anyAccess).map((c) => (
                  <div key={c.module} className="rounded-md border border-line bg-surface p-2.5">
                    <div className="text-[12.5px] font-medium text-ink">{c.label}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.actions.filter((a) => a.can).map((a) => (
                        <span key={a.action} className="rounded bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent">{a.action}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {result.capabilities.every((c) => !c.anyAccess) && (
                  <p className="text-[13px] text-ink-3">This user has no module access.</p>
                )}
              </div>
            </div>
          </PanelBody>
        )}
      </Panel>
    </div>
  );
}
