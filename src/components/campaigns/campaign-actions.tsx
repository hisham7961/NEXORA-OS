"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Select, Textarea, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast } from "@/components/providers";
import { setCampaignStatusAction, addCampaignMetricAction, deleteCampaignMetricAction } from "@/app/actions/campaigns";
import type { ActionResult } from "@/lib/action";
import { humanize } from "@/lib/status";

const METRICS = ["spend", "impressions", "reach", "clicks", "ctr", "cpc", "cpm", "leads", "conversions", "orders", "revenue", "roas", "custom"];

/** Lifecycle transitions offered from each status (linear but flexible). */
const NEXT: Record<string, string[]> = {
  draft: ["planning", "cancelled"],
  planning: ["waiting_creative", "ready", "cancelled"],
  waiting_creative: ["creative_review", "cancelled"],
  creative_review: ["ready", "waiting_creative", "cancelled"],
  ready: ["scheduled", "live", "cancelled"],
  scheduled: ["live", "cancelled"],
  live: ["monitoring", "reporting", "completed"],
  monitoring: ["reporting", "completed"],
  reporting: ["completed"],
  completed: [],
  cancelled: ["planning"],
};

export function CampaignStatusBar({ campaignId, status }: { campaignId: string; status: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const next = NEXT[status] ?? [];

  const move = (to: string) =>
    start(async () => {
      const res: ActionResult = await setCampaignStatusAction(campaignId, to);
      if (res.ok) {
        toast({ kind: "success", title: `Moved to ${humanize(to)}` });
        router.refresh();
      } else toast({ kind: "error", title: res.error });
    });

  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Advance lifecycle</div>
      {next.length === 0 ? (
        <p className="text-[13px] text-ink-3">No further transitions from “{humanize(status)}”.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {next.map((to) => (
            <Button
              key={to}
              size="sm"
              variant={to === "cancelled" ? "danger" : to === "completed" ? "primary" : "secondary"}
              disabled={pending}
              onClick={() => move(to)}
            >
              {humanize(to)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AddMetricButton({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Log metric</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Log a metric" description="Record a manual performance metric or a target. Actual spend keeps the budget in sync.">
        <ActionForm action={addCampaignMetricAction} submitLabel="Add metric" onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <FormSection>
            <FormField label="Metric" name="name" required>
              <Select name="name" defaultValue="spend">{METRICS.map((m) => <option key={m} value={m}>{humanize(m)}</option>)}</Select>
            </FormField>
            <FormField label="Value" name="value" required>
              <Input type="number" step="any" name="value" required placeholder="0" />
            </FormField>
            <FormField label="Unit" name="unit" hint="Optional">
              <Input name="unit" placeholder="e.g. KWD, %" />
            </FormField>
            <FormField label="Date" name="date" hint="Defaults to today">
              <Input type="date" name="date" />
            </FormField>
          </FormSection>
          <FormField label="Note" name="note">
            <Textarea name="note" placeholder="Context for this data point…" className="min-h-14" />
          </FormField>
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" name="isTarget" className="accent-[var(--accent)]" /> This is a target (not actual)
          </label>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function DeleteMetricButton({ campaignId, metricId }: { campaignId: string; metricId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      aria-label="Delete metric"
      className="text-ink-3 hover:text-critical disabled:opacity-50"
      onClick={() =>
        start(async () => {
          const res = await deleteCampaignMetricAction(campaignId, metricId);
          if (res.ok) { toast({ kind: "success", title: "Metric removed" }); router.refresh(); }
          else toast({ kind: "error", title: res.error });
        })
      }
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
