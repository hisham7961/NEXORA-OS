import type { Metadata } from "next";
import type { Task } from "@prisma/client";
import { ListTodo } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listTasks, taskQuerySchema } from "@/domain/tasks";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { TaskDrawerForm } from "@/components/tasks/task-drawer-form";
import { PageHeader, Panel, DataTable, StatusBadge, Badge, EmptyState, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { BrandChip, UserChip } from "@/components/entity-chips";
import { formatDateShort } from "@/lib/format";
import { PRIORITY_CATEGORY } from "@/lib/status";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("tasks.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const query = taskQuerySchema.parse(sp);
  const canCreate = canAnywhere(principal, "tasks.create");
  const [{ rows, total }, lookups, options] = await Promise.all([
    listTasks(principal, query),
    getLookups(),
    canCreate ? getScopedOptions(principal, "tasks.create") : Promise.resolve(null),
  ]);
  const now = new Date();

  const columns: Column<Task>[] = [
    { key: "title", header: t("tasks.col.task"), render: (r) => r.title },
    { key: "brand", header: t("common.brand"), render: (r) => <BrandChip name={refName(lookups.brands, r.brandId)} color={r.brandId ? lookups.brands.get(r.brandId)?.meta : null} /> },
    { key: "owner", header: t("common.owner"), render: (r) => <UserChip name={refName(lookups.users, r.ownerId)} color={r.ownerId ? lookups.users.get(r.ownerId)?.meta : null} /> },
    { key: "priority", header: t("common.priority"), render: (r) => <Badge category={PRIORITY_CATEGORY[r.priority] ?? "neutral"}>{t(`priority.${r.priority}`)}</Badge> },
    { key: "due", header: t("common.due"), align: "end", render: (r) => <span className={r.dueDate && r.dueDate < now && !["completed", "cancelled"].includes(r.status) ? "text-critical tabular" : "text-ink-3 tabular"}>{formatDateShort(r.dueDate, locale)}</span> },
    { key: "status", header: t("common.status"), render: (r) => <StatusBadge module="task" status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title={t("tasks.title")}
        description={t("tasks.subtitle")}
        meta={<Badge>{t("tasks.count", { n: total })}</Badge>}
        actions={canCreate && options ? <TaskDrawerForm mode="create" options={options} /> : undefined}
      />
      <ListToolbar
        placeholder={t("tasks.searchPlaceholder")}
        filters={[
          { name: "status", label: t("common.status"), options: ["todo", "in_progress", "blocked", "review", "completed"].map((v) => ({ value: v, label: t(`status.${v}`) })) },
          { name: "priority", label: t("common.priority"), options: ["low", "normal", "high", "urgent"].map((v) => ({ value: v, label: t(`priority.${v}`) })) },
        ]}
      />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} getRowHref={(r) => `/tasks/${r.id}`}
          empty={<EmptyState icon={<ListTodo className="h-5 w-5" />} title={t("tasks.empty")} description={t("tasks.emptyBody")} />} />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
