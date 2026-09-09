import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { getApproval } from "@/domain/approvals";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { humanize } from "@/lib/status";

export const metadata: Metadata = { title: "Approval" };

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await pageGuard("approvals.view");
  const { id } = await params;
  const [request, lookups] = await Promise.all([getApproval(id), getLookups()]);
  if (!request) notFound();
  const { locale } = await pageGuard();

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/approvals" className="hover:text-ink-2">Approvals</Link> / {request.title}</div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-ink">{request.title}</h1>
        <div className="flex items-center gap-2"><Badge>{humanize(request.type)}</Badge><StatusBadge module="approval" status={request.status} /></div>
      </div>
      <Panel>
        <PanelHeader title="Approval chain" description="Multi-step routing with full history (§24)" />
        <PanelBody>
          <ol className="space-y-3">
            {request.steps.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink-2 tabular">{s.order}</span>
                <div className="flex-1">
                  <div className="text-[13px] text-ink">{s.approverUserId ? refName(lookups.users, s.approverUserId) : s.approverRole ?? "Approver"}</div>
                  {s.comment && <div className="text-xs text-ink-3">{s.comment}</div>}
                  {s.decidedAt && <div className="text-[11px] text-ink-3">{formatDateTime(s.decidedAt, locale)}</div>}
                </div>
                <StatusBadge module="approval" status={s.status} />
              </li>
            ))}
          </ol>
        </PanelBody>
      </Panel>
    </>
  );
}
