"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Archive, GitBranch } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast } from "@/components/providers";
import { createWorkflowAction, archiveWorkflowAction, openWorkflowRevisionAction } from "@/app/actions/workflows";
import type { Option } from "@/domain/options";

/** Modules a workflow can govern — the operational modules with a stage lifecycle. */
const GOVERNABLE_MODULES = [
  "registrations", "cases", "campaigns", "design", "documents", "expenses", "tasks", "answers", "knowledge", "whatsapp",
];

export function CreateWorkflowButton({ options }: { options: { brands: Option[]; countries: Option[]; companies: Option[] } }) {
  const [open, setOpen] = useState(false);
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New workflow</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="New workflow" description="Create a versioned workflow. It starts as an editable draft with a starter template you refine in the builder." width="560px">
        <ActionForm action={createWorkflowAction} submitLabel="Create" onCancel={() => setOpen(false)} onSuccess={(d) => { setOpen(false); const id = (d as { id?: string })?.id; if (id) router.push(`/workflows/${id}`); }}>
          <FormField label="Name" name="name" required><Input name="name" required placeholder="e.g. Product Registration Approval" /></FormField>
          <FormSection>
            <FormField label="Key" name="key" required hint="Stable machine key — lower_snake_case"><Input name="key" required placeholder="registration_approval" /></FormField>
            <FormField label="Governs module" name="module" required><Select name="module" defaultValue="registrations">{GOVERNABLE_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}</Select></FormField>
            <FormField label="Company" name="companyId" hint="Optional — scope this workflow"><Select name="companyId" defaultValue=""><option value="">All companies</option>{options.companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
            <FormField label="Brand" name="brandId"><Select name="brandId" defaultValue=""><option value="">All brands</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
            <FormField label="Country" name="countryId"><Select name="countryId" defaultValue=""><option value="">All countries</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
          </FormSection>
          <FormField label="Description" name="description"><Textarea name="description" className="min-h-14" placeholder="What this workflow governs." /></FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function OpenRevisionButton({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={async () => {
      setPending(true);
      const r = await openWorkflowRevisionAction(workflowId);
      setPending(false);
      if (r.ok) { toast({ kind: "success", title: "New draft revision opened" }); router.refresh(); }
      else toast({ kind: "error", title: r.error });
    }}><GitBranch className="h-3.5 w-3.5" /> New revision</Button>
  );
}

export function ArchiveWorkflowButton({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={async () => {
      setPending(true);
      const r = await archiveWorkflowAction(workflowId);
      setPending(false);
      if (r.ok) { toast({ kind: "success", title: "Workflow archived" }); router.push("/workflows"); }
      else toast({ kind: "error", title: r.error });
    }}><Archive className="h-3.5 w-3.5" /> Archive</Button>
  );
}
