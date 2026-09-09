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
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Workflow</div>
          <div className="flex flex-wrap gap-2">
            {transitions.map((to) => (
              <Button key={to} size="sm" variant={to === "approved" ? "primary" : "secondary"} disabled={pending} onClick={() => run(() => setWhatsappStatusAction(waId, to), `Moved to ${humanize(to)}`)}>
                {humanize(to)}
              </Button>
            ))}
          </div>
          {status === "review" && !canApprove && <p className="mt-1.5 text-[11px] text-ink-3">Approval requires the WhatsApp approve permission.</p>}
        </div>
      )}

      {canSend && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Execution</div>
          <Button variant="primary" size="sm" disabled={pending} onClick={() => run(() => markWhatsappSentAction(waId), "Marked sent")}>
            <Send className="h-4 w-4" /> Mark sent
          </Button>
        </div>
      )}

      {(status === "sent" || status === "reported") && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Results</div>
          <Button variant="secondary" size="sm" onClick={() => setResultsOpen(true)}>{status === "reported" ? "Update results" : "Enter results"}</Button>
          <Drawer open={resultsOpen} onClose={() => setResultsOpen(false)} title="Campaign results" description="Delivery and engagement reported by the sender.">
            <ActionForm action={recordWhatsappResultsAction} submitLabel="Save results" onCancel={() => setResultsOpen(false)} onSuccess={() => { setResultsOpen(false); router.refresh(); }}>
              <input type="hidden" name="waId" value={waId} />
              <FormSection>
                <FormField label="Sent" name="sent"><Input type="number" min="0" name="sent" placeholder="0" /></FormField>
                <FormField label="Delivered" name="delivered"><Input type="number" min="0" name="delivered" placeholder="0" /></FormField>
                <FormField label="Read" name="read"><Input type="number" min="0" name="read" placeholder="0" /></FormField>
                <FormField label="Replied" name="replied"><Input type="number" min="0" name="replied" placeholder="0" /></FormField>
                <FormField label="Opt-outs" name="optOut"><Input type="number" min="0" name="optOut" placeholder="0" /></FormField>
                <FormField label="Conversions" name="conversions"><Input type="number" min="0" name="conversions" placeholder="0" /></FormField>
              </FormSection>
              <FormField label="Note" name="note"><Textarea name="note" className="min-h-14" placeholder="Anything worth noting…" /></FormField>
            </ActionForm>
          </Drawer>
        </div>
      )}

      {status === "reported" && <p className="text-[12px] text-ink-3">This campaign is complete.</p>}
    </div>
  );
}
