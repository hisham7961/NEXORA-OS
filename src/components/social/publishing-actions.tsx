"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { setPublishingStatusAction, confirmScheduledAction, confirmPublishedAction } from "@/app/actions/social";
import type { ActionResult } from "@/lib/action";

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
  const { t } = useI18n();
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
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("pubb.workflowStage")}</div>
        <div className="flex flex-wrap gap-2">
          <Select value={WORKFLOW.includes(status) ? status : ""} disabled={pending || isPublished} onChange={(e) => e.target.value && run(() => setPublishingStatusAction(itemId, e.target.value), t("common.movedTo", { status: t(`status.${e.target.value}`) }))} className="w-48">
            <option value="" disabled>{t("pubb.setStage")}</option>
            {WORKFLOW.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </Select>
          {status !== "cancelled" && !isPublished && (
            <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => setPublishingStatusAction(itemId, "cancelled"), t("pubb.cancelled"))}>{t("pubb.cancel")}</Button>
          )}
        </div>
      </div>

      <div className="rounded-md border border-line p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("pubb.verificationCheckpoints")}</div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] text-ink-2">
              <CalendarCheck className={`h-4 w-4 ${isScheduled ? "text-accent" : "text-ink-3"}`} />
              {isScheduled ? t("pubb.schedulingConfirmed") : t("pubb.notScheduled")}
            </div>
            {!isScheduled && (
              <Button variant="secondary" size="sm" disabled={pending || status !== "approved"} onClick={() => run(() => confirmScheduledAction(itemId), t("pubb.schedulingConfirmed"))}>
                {t("pubb.confirmScheduled")}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[13px] text-ink-2">
              <CheckCircle2 className={`h-4 w-4 ${isPublished ? "text-success" : "text-ink-3"}`} />
              {isPublished ? t("pubb.publishedConfirmed") : t("pubb.notPublished")}
            </div>
            {!isPublished && (
              <div className="flex gap-2">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("pubb.publishedUrl")} disabled={pending || !isScheduled} className="flex-1" />
                <Button variant="primary" size="sm" disabled={pending || !isScheduled} onClick={() => run(async () => { const r = await confirmPublishedAction(itemId, url.trim()); if (r.ok) setUrl(""); return r; }, t("pubb.publishedConfirmed"))}>
                  {t("pubb.confirmPublished")}
                </Button>
              </div>
            )}
          </div>
        </div>
        {status !== "approved" && !isScheduled && (
          <p className="mt-2 text-[11px] text-ink-3">{t("pubb.mustBeApproved")}</p>
        )}
      </div>
    </div>
  );
}
