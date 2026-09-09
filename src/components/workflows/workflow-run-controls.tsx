"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, ArrowRight } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { performTransitionAction, startWorkflowInstanceAction } from "@/app/actions/workflows";

export interface TransitionOption { key: string; name: string; to: string; requiredFields: string[] }

/** Buttons that move a record along its workflow. Prompts for any required fields. */
export function TransitionControls({ instanceId, transitions }: { instanceId: string; transitions: TransitionOption[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [active, setActive] = useState<TransitionOption | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const run = (tr: TransitionOption) => start(async () => {
    const res = await performTransitionAction(instanceId, tr.key, note || undefined, Object.keys(fields).length ? fields : undefined);
    if (res.ok) { toast({ kind: "success", title: `Moved: ${tr.name}` }); setActive(null); setFields({}); setNote(""); router.refresh(); }
    else toast({ kind: "error", title: res.error });
  });

  if (transitions.length === 0) return <p className="text-[12px] text-ink-3">No actions available to you from this stage.</p>;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {transitions.map((tr) => (
          <Button key={tr.key} size="sm" variant="secondary" disabled={pending}
            onClick={() => (tr.requiredFields.length ? setActive(active?.key === tr.key ? null : tr) : run(tr))}>
            {tr.name} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        ))}
      </div>
      {active && (
        <div className="space-y-2 rounded-md border border-line bg-surface-2 p-3">
          <p className="text-[12px] text-ink-2">&ldquo;{active.name}&rdquo; requires:</p>
          {active.requiredFields.map((f) => (
            <label key={f} className="block"><span className="mb-1 block font-mono text-[11px] text-ink-3">{f}</span>
              <Input value={fields[f] ?? ""} onChange={(e) => setFields((p) => ({ ...p, [f]: e.target.value }))} /></label>
          ))}
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">Note (optional)</span><Input value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setActive(null)}>Cancel</Button><Button size="sm" variant="primary" disabled={pending || active.requiredFields.some((f) => !(fields[f] ?? "").trim())} onClick={() => run(active)}>Confirm</Button></div>
        </div>
      )}
    </div>
  );
}

/** Start the governing workflow for a record that has none yet. */
export function StartWorkflowControls({ definitionId, entityType, entityId, scope, label }: { definitionId: string; entityType: string; entityId: string; scope: { companyId: string | null; brandId: string | null; countryId: string | null }; label: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="primary" disabled={pending} onClick={() => start(async () => {
      const res = await startWorkflowInstanceAction({ definitionId, entityType, entityId, scope });
      if (res.ok) { toast({ kind: "success", title: `Started: ${label}` }); router.refresh(); }
      else toast({ kind: "error", title: res.error });
    })}><Play className="h-3.5 w-3.5" /> Start {label}</Button>
  );
}
