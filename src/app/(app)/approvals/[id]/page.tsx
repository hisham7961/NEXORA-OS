import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { can } from "@/lib/permissions/engine";
import { getApproval } from "@/domain/approvals";
import { getActivity } from "@/domain/mutation";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Badge } from "@/components/ui";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { DecisionBar } from "@/components/approvals/decision-bar";
import { formatDateTime } from "@/lib/format";
import { humanize } from "@/lib/status";

export const metadata: Metadata = { title: "Approval" };

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("approvals.view");
  const { id } = await params;
  const [request, lookups] = await Promise.all([getApproval(id), getLookups()]);
  if (!request) notFound();
  const activity = await getActivity("ApprovalRequest", id);

  const scope = { companyId: request.companyId, brandId: request.brandId };
  const currentStep = request.steps.find((s) => s.order === request.currentStep);
  const isPending = request.status === "pending";
  const canDecide = isPending && !!currentStep && (currentStep.approverUserId === principal.userId || can(principal, "approvals.approve", scope));
  const canCancel = isPending && (request.requesterId === principal.userId || can(principal, "approvals.manage", scope));

  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : "System",
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/approvals" className="hover:text-ink-2">Approvals</Link> / {request.title}</div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">{request.title}</h1>
          <div className="mt-0.5 text-xs text-ink-3">Requested by {refName(lookups.users, request.requesterId)}</div>
        </div>
        <div className="flex items-center gap-2"><Badge>{humanize(request.type)}</Badge><StatusBadge module="approval" status={request.status} /></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader title="Approval chain" description="Sequential — each step approves after the previous (§24)." />
            <PanelBody>
              {request.notes && <p className="mb-3 rounded-md bg-surface-2/50 p-2.5 text-[13px] text-ink-2">{request.notes}</p>}
              <ol className="space-y-2.5">
                {request.steps.map((s) => {
                  const isCurrent = isPending && s.order === request.currentStep;
                  return (
                    <li key={s.id} className={`flex items-center gap-3 rounded-md border p-2.5 ${isCurrent ? "border-accent bg-accent-soft/40" : "border-line"}`}>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink-2 tabular">{s.order}</span>
                      <div className="flex-1">
                        <div className="text-[13px] text-ink">{s.approverUserId ? refName(lookups.users, s.approverUserId) : s.approverRole ?? "Approver"}</div>
                        {s.comment && <div className="text-xs text-ink-3">{s.comment}</div>}
                        {s.decidedAt && <div className="text-[11px] text-ink-3">{formatDateTime(s.decidedAt, locale)}</div>}
                      </div>
                      {isCurrent && <Badge category="warning" dot>Current</Badge>}
                      <StatusBadge module="approval" status={s.status} />
                    </li>
                  );
                })}
              </ol>
            </PanelBody>
          </Panel>

          {(canDecide || canCancel) && (
            <Panel>
              <PanelHeader title={canDecide ? "Your decision" : "Actions"} />
              <PanelBody><DecisionBar requestId={request.id} canDecide={canDecide} canCancel={canCancel} /></PanelBody>
            </Panel>
          )}
        </div>

        <Panel>
          <PanelHeader title="Activity" />
          <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty="No decisions yet." /></PanelBody>
        </Panel>
      </div>
    </>
  );
}
