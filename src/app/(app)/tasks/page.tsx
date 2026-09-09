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

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("tasks.view");
  if (denied) return <AccessDenied locale={locale} />;
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
    { key: "title", header: "Task", render: (t) => t.title },
    { key: "brand", header: "Brand", render: (t) => <BrandChip name={refName(lookups.brands, t.brandId)} color={t.brandId ? lookups.brands.get(t.brandId)?.meta : null} /> },
    { key: "owner", header: "Owner", render: (t) => <UserChip name={refName(lookups.users, t.ownerId)} color={t.ownerId ? lookups.users.get(t.ownerId)?.meta : null} /> },
    { key: "priority", header: "Priority", render: (t) => <Badge category={PRIORITY_CATEGORY[t.priority] ?? "neutral"}>{t.priority}</Badge> },
    { key: "due", header: "Due", align: "end", render: (t) => <span className={t.dueDate && t.dueDate < now && !["completed", "cancelled"].includes(t.status) ? "text-critical tabular" : "text-ink-3 tabular"}>{formatDateShort(t.dueDate, locale)}</span> },
    { key: "status", header: "Status", render: (t) => <StatusBadge module="task" status={t.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Tasks"
        description="One universal task engine across the whole platform."
        meta={<Badge>{total} tasks</Badge>}
        actions={canCreate && options ? <TaskDrawerForm mode="create" options={options} /> : undefined}
      />
      <ListToolbar
        placeholder="Search tasks…"
        filters={[
          { name: "status", label: "Status", options: ["todo", "in_progress", "blocked", "review", "completed"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })) },
          { name: "priority", label: "Priority", options: ["low", "normal", "high", "urgent"].map((v) => ({ value: v, label: v })) },
        ]}
      />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(t) => t.id} getRowHref={(t) => `/tasks/${t.id}`}
          empty={<EmptyState icon={<ListTodo className="h-5 w-5" />} title="No tasks in your scope" description="Tasks assigned to you or created within your scope will appear here." />} />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
