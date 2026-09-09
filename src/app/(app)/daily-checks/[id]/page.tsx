import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { ForbiddenError } from "@/lib/permissions/engine";
import { getInstanceForExecution } from "@/domain/daily-checks";
import { getActivity } from "@/domain/mutation";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Badge } from "@/components/ui";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { CheckExecution } from "@/components/daily-checks/check-execution";
import { VerifyButton } from "@/components/daily-checks/manager-actions";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Daily Check" };

export default async function DailyCheckInstancePage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("daily_checks.view");
  const { id } = await params;
  let data;
  try {
    data = await getInstanceForExecution(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!data) notFound();
  const { instance, template, items, isOwner, isManager } = data;
  const [lookups, activity] = await Promise.all([getLookups(), getActivity("ChecklistInstance", id)]);

  const editable = isOwner && instance.status !== "complete";
  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : "System",
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/daily-checks" className="hover:text-ink-2">Daily Checks</Link> / {template.name}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">{template.name}</h1>
          <div className="mt-0.5 text-xs text-ink-3">{formatDate(instance.date, locale)} · {refName(lookups.users, instance.userId)}</div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge module="task" status={instance.status === "complete" ? "completed" : instance.status} />
          {instance.verifiedById ? <Badge category="success" dot>Verified</Badge> : isManager && (instance.status === "complete" || instance.status === "late") ? <VerifyButton instanceId={instance.id} /> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Checkpoints" description={editable ? "Complete each item; some require a note or evidence link." : "Read-only view."} />
          <PanelBody>
            {editable ? (
              <CheckExecution instanceId={instance.id} items={items} />
            ) : (
              <ul className="space-y-2">
                {items.map((it) => (
                  <li key={it.id} className="flex items-start gap-2.5 rounded-md border border-line p-2.5 text-[13px]">
                    <span className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border ${it.isDone ? "border-success bg-success text-white" : "border-line-strong"}`}>{it.isDone && <Check className="h-3 w-3" />}</span>
                    <div className="min-w-0">
                      <div className={it.isDone ? "text-ink-3 line-through" : "text-ink"}>{it.text}</div>
                      {it.note && <div className="text-xs text-ink-3">Note: {it.note}</div>}
                      {it.link && <a href={it.link} className="text-xs text-accent hover:underline" target="_blank" rel="noreferrer">Evidence</a>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Activity" />
          <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty="No activity yet." /></PanelBody>
        </Panel>
      </div>
    </>
  );
}
