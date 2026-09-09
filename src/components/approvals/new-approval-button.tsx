"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ArrowDown } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createApprovalAction } from "@/app/actions/approvals";
import type { Option } from "@/domain/options";

const TYPES = ["campaign", "budget", "creative", "social", "answer", "refund", "document", "expense", "purchase", "report", "general"];

function ApproverSteps({ users }: { users: Option[] }) {
  const [steps, setSteps] = useState<string[]>([]);
  const byId = new Map(users.map((u) => [u.id, u.label]));
  const available = users.filter((u) => !steps.includes(u.id));

  return (
    <div className="space-y-2">
      {steps.map((id, i) => (
        <div key={id} className="flex items-center gap-2">
          <input type="hidden" name="approverIds" value={id} />
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink-2 tabular">{i + 1}</span>
          <span className="flex-1 text-[13px] text-ink">{byId.get(id)}</span>
          {i < steps.length - 1 && <ArrowDown className="h-3.5 w-3.5 text-ink-3" />}
          <button type="button" onClick={() => setSteps((s) => s.filter((x) => x !== id))} className="text-ink-3 hover:text-critical" aria-label="Remove"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      {available.length > 0 && (
        <Select value="" onChange={(e) => e.target.value && setSteps((s) => [...s, e.target.value])} aria-label="Add approver step">
          <option value="">+ Add approver step…</option>
          {available.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </Select>
      )}
      {steps.length === 0 && <p className="text-xs text-ink-3">Add approvers in order — each approves after the previous one.</p>}
    </div>
  );
}

export function NewApprovalButton({ options }: { options: { users: Option[]; brands: Option[]; companies: Option[] } }) {
  const [open, setOpen] = useState(false);
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New request</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Submit for approval" description="Route an item through sequential approvers.">
        <ActionForm action={createApprovalAction} submitLabel="Submit" onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <FormField label="Title" name="title" required>
            <Input name="title" placeholder="What needs approval?" required />
          </FormField>
          <FormSection>
            <FormField label="Type" name="type">
              <Select name="type" defaultValue="general">{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
            </FormField>
            <FormField label="Brand" name="brandId">
              <Select name="brandId" defaultValue=""><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
            </FormField>
          </FormSection>
          <FormField label="Notes" name="notes">
            <Textarea name="notes" placeholder="Context for approvers…" />
          </FormField>
          <FormField label="Approval chain" name="approverIds" required>
            <ApproverSteps users={options.users} />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}
