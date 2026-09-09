"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { useToast } from "@/components/providers";
import { setPublishingStatusAction, confirmScheduledAction, confirmPublishedAction } from "@/app/actions/social";
import type { ActionResult } from "@/lib/action";
import { humanize } from "@/lib/status";

const WORKFLOW = ["idea", "requested", "copywriting", "design", "review", "approved"];

export function PublishingActionBar({
  itemId,
  status,
  scheduledConfirmedAt,
  publishedConfirmedAt,
}: {
  itemId: string;
  status: string;
  scheduledConfirmedAt: string | null;
  publishedConfirmedAt: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [url, setUrl] = useState("");

  const run = (fn: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) { if (ok) toast({ kind: "success", title: ok }); router.refresh(); }
      else toast({ kind: "error", title: res.error });
    });

  const isPublished = !!publishedConfirmedAt;
  const isScheduled = !!scheduledConfirmedAt;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Workflow stage</div>
        <div className="flex flex-wrap gap-2">
          <Select value={WORKFLOW.includes(status) ? status : ""} disabled={pending || isPublished} onChange={(e) => e.target.value && run(() => setPublishingStatusAction(itemId, e.target.value), `Moved to ${humanize(e.target.value)}`)} className="w-48">
            <option value="" disabled>Set stage…</option>
            {WORKFLOW.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </Select>
          {status !== "cancelled" && !isPublished && (
            <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => setPublishingStatusAction(itemId, "cancelled"), "Cancelled")}>Cancel</Button>
          )}
        </div>
      </div>

      <div className="rounded-md border border-line p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Verification checkpoints</div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] text-ink-2">
              <CalendarCheck className={`h-4 w-4 ${isScheduled ? "text-accent" : "text-ink-3"}`} />
              {isScheduled ? "Scheduling confirmed" : "Not scheduled yet"}
            </div>
            {!isScheduled && (
              <Button variant="secondary" size="sm" disabled={pending || status !== "approved"} onClick={() => run(() => confirmScheduledAction(itemId), "Scheduling confirmed")}>
                Confirm scheduled
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[13px] text-ink-2">
              <CheckCircle2 className={`h-4 w-4 ${isPublished ? "text-success" : "text-ink-3"}`} />
              {isPublished ? "Published confirmed" : "Not published yet"}
            </div>
            {!isPublished && (
              <div className="flex gap-2">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Published URL (optional)" disabled={pending || !isScheduled} className="flex-1" />
                <Button variant="primary" size="sm" disabled={pending || !isScheduled} onClick={() => run(async () => { const r = await confirmPublishedAction(itemId, url.trim()); if (r.ok) setUrl(""); return r; }, "Published confirmed")}>
                  Confirm published
                </Button>
              </div>
            )}
          </div>
        </div>
        {status !== "approved" && !isScheduled && (
          <p className="mt-2 text-[11px] text-ink-3">Content must reach “Approved” before scheduling can be confirmed.</p>
        )}
      </div>
    </div>
  );
}
