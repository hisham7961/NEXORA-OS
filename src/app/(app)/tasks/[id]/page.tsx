import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { ForbiddenError } from "@/lib/permissions/engine";
import { getTask } from "@/domain/tasks";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Badge } from "@/components/ui";
import { BrandChip, UserChip, CountryChip } from "@/components/entity-chips";
import { formatDate } from "@/lib/format";
import { PRIORITY_CATEGORY } from "@/lib/status";

export const metadata: Metadata = { title: "Task" };

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
  const lookups = await getLookups();
  const assignees = task.assignees.filter((a) => a.role === "assignee");

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/tasks" className="hover:text-ink-2">Tasks</Link> / {task.title}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-ink">{task.title}</h1>
        <div className="flex items-center gap-2">
          <Badge category={PRIORITY_CATEGORY[task.priority] ?? "neutral"}>{task.priority}</Badge>
          <StatusBadge module="task" status={task.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Details" />
          <PanelBody className="space-y-4">
            {task.description ? <p className="text-[13px] text-ink-2 whitespace-pre-wrap">{task.description}</p> : <p className="text-[13px] text-ink-3">No description.</p>}
            {task.checklist.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Checklist ({task.checklist.filter((c) => c.isDone).length}/{task.checklist.length})</div>
                <ul className="space-y-1.5">
                  {task.checklist.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-[13px]">
                      <span className={`flex h-4 w-4 items-center justify-center rounded border ${c.isDone ? "border-success bg-success text-white" : "border-line-strong"}`}>{c.isDone && <Check className="h-3 w-3" />}</span>
                      <span className={c.isDone ? "text-ink-3 line-through" : "text-ink"}>{c.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Meta" />
          <PanelBody>
            <dl className="space-y-2.5 text-[13px]">
              <Row label="Owner"><UserChip name={refName(lookups.users, task.ownerId)} color={task.ownerId ? lookups.users.get(task.ownerId)?.meta : null} /></Row>
              <Row label="Brand"><BrandChip name={refName(lookups.brands, task.brandId)} color={task.brandId ? lookups.brands.get(task.brandId)?.meta : null} /></Row>
              <Row label="Country"><CountryChip name={refName(lookups.countries, task.countryId)} iso2={task.countryId ? lookups.countries.get(task.countryId)?.meta : null} /></Row>
              <Row label="Start">{formatDate(task.startDate, locale)}</Row>
              <Row label="Due">{formatDate(task.dueDate, locale)}</Row>
              <Row label="Assignees">{assignees.length ? assignees.map((a) => refName(lookups.users, a.userId)).join(", ") : "—"}</Row>
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
      <dd className="text-ink text-end">{children}</dd>
    </div>
  );
}
