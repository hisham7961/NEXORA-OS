"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X, RotateCcw } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer, StatusBadge } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast } from "@/components/providers";
import { requestCorrectionAction, decideCorrectionAction } from "@/app/actions/attendance";

const TYPES = [
  { v: "missed_check_in", label: "Missed check-in", field: "actualStart", time: true },
  { v: "missed_check_out", label: "Missed check-out", field: "actualEnd", time: true },
  { v: "incorrect_time", label: "Incorrect time", field: "actualStart", time: true },
  { v: "break_error", label: "Break error", field: "breakMinutes", time: false },
  { v: "other", label: "Other", field: "", time: false },
];

export interface CorrectionRow {
  id: string;
  userName?: string;
  date: string;
  type: string;
  reason: string;
  status: string;
  requestedValue: string | null;
  oldValue: string | null;
}

export function RequestCorrectionButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(TYPES[0]);
  const router = useRouter();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Request correction</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Request attendance correction" description="Your manager reviews the request; your original record is preserved.">
        <ActionForm action={requestCorrectionAction} submitLabel="Submit request" onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <input type="hidden" name="field" value={type.field} />
          <FormSection>
            <FormField label="Type" name="type" required>
              <Select name="type" defaultValue={type.v} onChange={(e) => setType(TYPES.find((t) => t.v === e.target.value) ?? TYPES[0])}>
                {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Date" name="date" required><Input type="date" name="date" required /></FormField>
            {type.field && (
              <FormField label={type.time ? "Correct time" : "Correct break minutes"} name="requestedValue" hint={type.time ? "The right time" : "Minutes"}>
                <Input type={type.time ? "datetime-local" : "number"} name="requestedValue" min={type.time ? undefined : "0"} />
              </FormField>
            )}
          </FormSection>
          <FormField label="Reason" name="reason" required><Textarea name="reason" required placeholder="Explain what needs correcting…" className="min-h-16" /></FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function CorrectionList({ rows, canDecide }: { rows: CorrectionRow[]; canDecide: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const decide = (id: string, decision: "approved" | "rejected" | "changes_requested") =>
    start(async () => {
      const r = await decideCorrectionAction(id, decision);
      if (r.ok) { toast({ kind: "success", title: `Correction ${decision.replace("_", " ")}` }); router.refresh(); }
      else toast({ kind: "error", title: r.error });
    });

  if (rows.length === 0) return <p className="px-4 py-3 text-[13px] text-ink-3">No corrections.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((c) => (
        <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {canDecide && c.userName && <span className="text-[13px] font-medium text-ink">{c.userName}</span>}
              <span className="text-[12.5px] text-ink-2 capitalize">{c.type.replace(/_/g, " ")}</span>
              <span className="text-[11px] text-ink-3">{new Date(c.date).toISOString().slice(0, 10)}</span>
              <StatusBadge module="generic" status={c.status} />
            </div>
            <p className="mt-0.5 text-[12px] text-ink-3">{c.reason}</p>
            {c.requestedValue && <p className="text-[11px] text-ink-3">Requested: {c.requestedValue}{c.oldValue ? ` (was ${c.oldValue})` : ""}</p>}
          </div>
          {canDecide && c.status === "pending" && (
            <div className="flex shrink-0 gap-1.5">
              <Button size="sm" variant="primary" disabled={pending} onClick={() => decide(c.id, "approved")}><Check className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => decide(c.id, "changes_requested")}><RotateCcw className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="danger" disabled={pending} onClick={() => decide(c.id, "rejected")}><X className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
