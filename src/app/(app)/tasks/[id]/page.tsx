import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getTask } from "@/domain/tasks";
import { getActivity } from "@/domain/mutation";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Badge } from "@/components/ui";
import { BrandChip, UserChip, CountryChip } from "@/components/entity-chips";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { TaskDrawerForm, type TaskDefaults } from "@/components/tasks/task-drawer-form";
import { StatusControl, ChecklistPanel, ArchiveTaskButton } from "@/components/tasks/task-detail-actions";
import { formatDate } from "@/lib/format";
import { PRIORITY_CATEGORY } from "@/lib/status";

export const metadata: Metadata = { title: "Task" };

const toYmd = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("tasks.view");
  const { id } = await params;
  let task;
  try {
    task = await getTask(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!task) notFound();

  const canEdit = canAnywhere(principal, "tasks.edit");
  const canDelete = canAnywhere(principal, "tasks.delete");
  const [lookups, activity, options] = await Promise.all([
    getLookups(),
    getActivity("Task", id),
    canEdit ? getScopedOptions(principal, "tasks.edit") : Promise.resolve(null),
  ]);

  const assignees = task.assignees.filter((a) => a.role === "assignee");
  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id,
    at: a.at,
    actorName: a.actorId ? refName(lookups.users, a.actorId) : "System",
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null,
    action: a.action,
    summary: a.summary,
  }));

  const editDefaults: TaskDefaults = {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    startDate: toYmd(task.startDate),
    dueDate: toYmd(task.dueDate),
    brandId: task.brandId,
    countryId: task.countryId,
    companyId: task.companyId,
    projectId: task.projectId,
    ownerId: task.ownerId,
    assigneeIds: assignees.map((a) => a.userId),
    approvalRequired: task.approvalRequired,
  };

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/tasks" className="hover:text-ink-2">Tasks</Link> / {task.title}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-ink">{task.title}</h1>
        <div className="flex items-center gap-2">
          <Badge category={PRIORITY_CATEGORY[task.priority] ?? "neutral"}>{task.priority}</Badge>
          {canEdit ? <StatusControl taskId={task.id} status={task.status} /> : <StatusBadge module="task" status={task.status} />}
          {canEdit && options && <TaskDrawerForm mode="edit" options={options} defaults={editDefaults} variant="secondary" label="Edit" />}
          {canDelete && <ArchiveTaskButton taskId={task.id} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader title="Details" />
            <PanelBody className="space-y-4">
              {task.description ? <p className="whitespace-pre-wrap text-[13px] text-ink-2">{task.description}</p> : <p className="text-[13px] text-ink-3">No description.</p>}
              {(task.checklist.length > 0 || canEdit) && (
                canEdit ? (
                  <ChecklistPanel taskId={task.id} items={task.checklist.map((c) => ({ id: c.id, text: c.text, isDone: c.isDone }))} />
                ) : (
                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Checklist ({task.checklist.filter((c) => c.isDone).length}/{task.checklist.length})</div>
                    <ul className="space-y-1.5">
                      {task.checklist.map((c) => (
                        <li key={c.id} className={`text-[13px] ${c.isDone ? "text-ink-3 line-through" : "text-ink"}`}>• {c.text}</li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Activity" description="Readable timeline from the audit trail (§47)." />
            <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty="No activity recorded yet." /></PanelBody>
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="Meta" />
          <PanelBody>
            <dl className="space-y-2.5 text-[13px]">
              <Row label="Owner"><UserChip name={refName(lookups.users, task.ownerId)} color={task.ownerId ? lookups.users.get(task.ownerId)?.meta : null} /></Row>
              <Row label="Brand"><BrandChip name={refName(lookups.brands, task.brandId)} color={task.brandId ? lookups.brands.get(task.brandId)?.meta : null} /></Row>
              <Row label="Market"><CountryChip name={refName(lookups.countries, task.countryId)} iso2={task.countryId ? lookups.countries.get(task.countryId)?.meta : null} /></Row>
              <Row label="Start">{formatDate(task.startDate, locale)}</Row>
              <Row label="Due">{formatDate(task.dueDate, locale)}</Row>
              <Row label="Assignees">{assignees.length ? assignees.map((a) => refName(lookups.users, a.userId)).join(", ") : "—"}</Row>
              {task.approvalRequired && <Row label="Approval"><Badge category="warning">Required</Badge></Row>}
            </dl>
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-end text-ink">{children}</dd>
    </div>
  );
}
