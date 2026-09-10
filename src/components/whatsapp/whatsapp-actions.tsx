"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button, Input, Textarea, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast } from "@/components/providers";
import { setWhatsappStatusAction, markWhatsappSentAction, recordWhatsappResultsAction } from "@/app/actions/whatsapp";
import type { ActionResult } from "@/lib/action";
import { humanize } from "@/lib/status";
import { useI18n } from "@/components/providers";

const NEXT: Record<string, string[]> = {
  draft: ["creative", "ready"],
  creative: ["review", "draft"],
  review: ["approved", "creative"],
  approved: ["ready", "review"],
  ready: [],
  sent: [],
  reported: [],
};

export function WhatsappActionBar({ waId, status, canApprove }: { waId: string; status: string; canApprove: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [resultsOpen, setResultsOpen] = useState(false);

  const run = (fn: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) { if (ok) toast({ kind: "success", title: ok }); router.refresh(); }
      else toast({ kind: "error", title: res.error });
    });

  const transitions = (NEXT[status] ?? []).filter((s) => s !== "approved" || canApprove);
  const canSend = status === "ready" || status === "approved";

  return (
    <div className="space-y-4">
      {transitions.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("wa.workflow")}</div>
          <div className="flex flex-wrap gap-2">
            {transitions.map((to) => (
              <Button key={to} size="sm" variant={to === "approved" ? "primary" : "secondary"} disabled={pending} onClick={() => run(() => setWhatsappStatusAction(waId, to), t("wa.movedTo", { status: t(`status.${to}`) }))}>
                {t(`status.${to}`)}
              </Button>
            ))}
          </div>
          {status === "review" && !canApprove && <p className="mt-1.5 text-[11px] text-ink-3">{t("wa.approvalPerm")}</p>}
        </div>
      )}

      {canSend && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("wa.execution")}</div>
          <Button variant="primary" size="sm" disabled={pending} onClick={() => run(() => markWhatsappSentAction(waId), t("wa.markedSent"))}>
            <Send className="h-4 w-4" /> {t("wa.markSent")}
          </Button>
        </div>
      )}

      {(status === "sent" || status === "reported") && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("wa.results")}</div>
          <Button variant="secondary" size="sm" onClick={() => setResultsOpen(true)}>{status === "reported" ? t("wa.updateResults") : t("wa.enterResults")}</Button>
          <Drawer open={resultsOpen} onClose={() => setResultsOpen(false)} title={t("wa.campaignResults")} description={t("wa.resultsSub")}>
            <ActionForm action={recordWhatsappResultsAction} submitLabel={t("wa.saveResults")} onCancel={() => setResultsOpen(false)} onSuccess={() => { setResultsOpen(false); router.refresh(); }}>
              <input type="hidden" name="waId" value={waId} />
              <FormSection>
                <FormField label={t("wa.sent")} name="sent"><Input type="number" min="0" name="sent" placeholder="0" /></FormField>
                <FormField label={t("wa.delivered")} name="delivered"><Input type="number" min="0" name="delivered" placeholder="0" /></FormField>
                <FormField label={t("wa.read")} name="read"><Input type="number" min="0" name="read" placeholder="0" /></FormField>
                <FormField label={t("wa.replied")} name="replied"><Input type="number" min="0" name="replied" placeholder="0" /></FormField>
                <FormField label={t("wa.optOuts")} name="optOut"><Input type="number" min="0" name="optOut" placeholder="0" /></FormField>
                <FormField label={t("wa.conversions")} name="conversions"><Input type="number" min="0" name="conversions" placeholder="0" /></FormField>
              </FormSection>
              <FormField label={t("wa.note")} name="note"><Textarea name="note" className="min-h-14" placeholder={t("wa.phNote")} /></FormField>
            </ActionForm>
          </Drawer>
        </div>
      )}

      {status === "reported" && <p className="text-[12px] text-ink-3">{t("wa.complete")}</p>}
    </div>
  );
}
