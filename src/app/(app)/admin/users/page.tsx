import type { Metadata } from "next";
import { UserCog } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listUsers, userQuerySchema } from "@/domain/users-admin";
import { StatusBadge, EmptyState, Badge, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { UserChip } from "@/components/entity-chips";

export const metadata: Metadata = { title: "Users" };

type Row = Awaited<ReturnType<typeof listUsers>>["rows"][number];

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { locale, denied } = await pageGuard("users.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const query = userQuerySchema.parse(sp);
  const { rows, total } = await listUsers(query);

  const columns: Column<Row>[] = [
    { key: "name", header: "User", render: (u) => <UserChip name={u.name} color={u.avatarColor} /> },
    { key: "email", header: "Email", render: (u) => <span className="text-ink-2">{u.email}</span> },
    { key: "title", header: "Title", render: (u) => u.title ?? "—" },
    { key: "roles", header: "Roles", align: "center", render: (u) => <span className="tabular text-ink-3">{u._count.roleAssignments}</span> },
    { key: "status", header: "Status", render: (u) => (u.isSuperAdmin ? <Badge category="critical" dot>Super Admin</Badge> : <StatusBadge module="generic" status={u.status} />) },
  ];

  return (
    <ResourceList title="Users" description="People with access, and their scoped role assignments." countLabel="users"
      searchPlaceholder="Search users…"
      filters={[{ name: "status", label: "Status", options: ["active", "suspended", "invited"].map((v) => ({ value: v, label: v })) }]}
      columns={columns} rows={rows} getRowKey={(u) => u.id} getRowHref={(u) => `/admin/users/${u.id}`}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<UserCog className="h-5 w-5" />} title="No users" description="Invite users and assign scoped roles to grant access." />} />
  );
}
