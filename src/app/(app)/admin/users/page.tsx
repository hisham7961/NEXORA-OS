import type { Metadata } from "next";
import { UserCog } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
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
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const query = userQuerySchema.parse(sp);
  const { rows, total } = await listUsers(query);

  const columns: Column<Row>[] = [
    { key: "name", header: t("admin.col.user"), render: (u) => <UserChip name={u.name} color={u.avatarColor} /> },
    { key: "email", header: t("common.email"), render: (u) => <span className="text-ink-2">{u.email}</span> },
    { key: "title", header: t("common.title2"), render: (u) => u.title ?? "—" },
    { key: "roles", header: t("admin.col.roles"), align: "center", render: (u) => <span className="tabular text-ink-3">{u._count.roleAssignments}</span> },
    { key: "status", header: t("common.status"), render: (u) => (u.isSuperAdmin ? <Badge category="critical" dot>{t("admin.superAdmin")}</Badge> : <StatusBadge module="generic" status={u.status} />) },
  ];

  return (
    <ResourceList title={t("admin.users")} description={t("admin.usersSub")} countLabel={t("admin.users")}
      searchPlaceholder={t("admin.searchUsers")}
      filters={[{ name: "status", label: t("common.status"), options: ["active", "suspended", "invited"].map((v) => ({ value: v, label: t(`status.${v}`) })) }]}
      columns={columns} rows={rows} getRowKey={(u) => u.id} getRowHref={(u) => `/admin/users/${u.id}`}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<UserCog className="h-5 w-5" />} title={t("admin.noUsers")} description={t("admin.noUsersSub")} />} />
  );
}
