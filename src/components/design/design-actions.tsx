"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X } from "lucide-react";
import { Button, Textarea, Drawer } from "@/components/ui";
import { ActionForm, FormField } from "@/components/form/action-form";
import { useToast, useI18n } from "@/components/providers";
import { setDesignStatusAction, addDesignVersionAction, approveDesignVersionAction, rejectDesignVersionAction } from "@/app/actions/design";
import type { ActionResult } from "@/lib/action";

const NEXT: Record<string, string[]> = {
  requested: ["brief_review", "assigned"],
  brief_review: ["assigned", "requested"],
  assigned: ["designing"],
  designing: ["internal_review"],
  internal_review: ["waiting_approval", "revision"],
  revision: ["designing"],
  waiting_approval: ["revision"],
  approved: ["delivered", "revision"],
  delivered: ["published"],
  published: [],
  archived: [],
};

function useRun() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) { if (ok) toast({ kind: "success", title: ok }); router.refresh(); }
      else toast({ kind: "error", title: res.error });
    });
  return { run, pending };
}

export function DesignStatusBar({ requestId, status }: { requestId: string; status: string }) {
  const { run, pending } = useRun();
  const { t } = useI18n();
  const next = NEXT[status] ?? [];
  if (next.length === 0) return <p className="text-[13px] text-ink-3">{t("des.noTransitions", { status: t(`status.${status}`) })}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {next.map((to) => (
        <Button key={to} size="sm" variant={to === "revision" ? "danger" : to === "waiting_approval" || to === "published" ? "primary" : "secondary"} disabled={pending} onClick={() => run(() => setDesignStatusAction(requestId, to), t("common.movedTo", { status: t(`status.${to}`) }))}>
          {t(`status.${to}`)}
        </Button>
      ))}
    </div>
  );
}

export function AddVersionButton({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { t } = useI18n();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("des.uploadVersion")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("des.uploadVersionTitle")} description={t("des.uploadVersionDesc")}>
        <ActionForm action={addDesignVersionAction} submitLabel={t("des.addVersion")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <input type="hidden" name="requestId" value={requestId} />
          <FormField label={t("des.artworkFile")} name="file" required>
            <input type="file" name="file" required className="block w-full text-[13px] text-ink-2 file:me-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-[12.5px] file:font-medium file:text-accent hover:file:bg-accent-soft/80" />
          </FormField>
          <FormField label={t("camp.notes")} name="note">
            <Textarea name="note" placeholder={t("des.versionNotePlaceholder")} className="min-h-16" />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function VersionDecision({ requestId, versionId, canApprove }: { requestId: string; versionId: string; canApprove: boolean }) {
  const { run, pending } = useRun();
  const { t } = useI18n();
  if (!canApprove) return null;
  return (
    <div className="flex gap-1.5">
      <Button variant="primary" size="sm" disabled={pending} onClick={() => run(() => approveDesignVersionAction(requestId, versionId), t("des.versionApproved"))}>
        <Check className="h-3.5 w-3.5" /> {t("des.approve")}
      </Button>
      <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => rejectDesignVersionAction(requestId, versionId), t("des.sentToRevision"))}>
        <X className="h-3.5 w-3.5" /> {t("des.reject")}
      </Button>
    </div>
  );
}
