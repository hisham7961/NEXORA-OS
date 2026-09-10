"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Archive, GitBranch } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast, useI18n } from "@/components/providers";
import { createWorkflowAction, archiveWorkflowAction, openWorkflowRevisionAction } from "@/app/actions/workflows";
import type { Option } from "@/domain/options";

/** Modules a workflow can govern — the operational modules with a stage lifecycle. */
const GOVERNABLE_MODULES = [
  "registrations", "cases", "campaigns", "design", "documents", "expenses", "tasks", "answers", "knowledge", "whatsapp",
];

export function CreateWorkflowButton({ options }: { options: { brands: Option[]; countries: Option[]; companies: Option[] } }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("wf.newWorkflow")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("wf.newWorkflow")} description={t("wf.newWorkflowSub")} width="560px">
        <ActionForm action={createWorkflowAction} submitLabel={t("common.create")} onCancel={() => setOpen(false)} onSuccess={(d) => { setOpen(false); const id = (d as { id?: string })?.id; if (id) router.push(`/workflows/${id}`); }}>
          <FormField label={t("common.name")} name="name" required><Input name="name" required placeholder={t("wf.phWorkflowName")} /></FormField>
          <FormSection>
            <FormField label={t("wf.key")} name="key" required hint={t("wf.stableKeyHint")}><Input name="key" required placeholder="registration_approval" /* i18n-ignore identifier example */ /></FormField>
            <FormField label={t("wf.governsModule")} name="module" required><Select name="module" defaultValue="registrations">{GOVERNABLE_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}</Select></FormField>
            <FormField label={t("common.company")} name="companyId" hint={t("wf.scopeHint")}><Select name="companyId" defaultValue=""><option value="">{t("wf.allCompanies")}</option>{options.companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
            <FormField label={t("common.brand")} name="brandId"><Select name="brandId" defaultValue=""><option value="">{t("wf.allBrands")}</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
            <FormField label={t("common.country")} name="countryId"><Select name="countryId" defaultValue=""><option value="">{t("wf.allCountries")}</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
          </FormSection>
          <FormField label={t("common.description")} name="description"><Textarea name="description" className="min-h-14" placeholder={t("wf.whatGoverns")} /></FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function OpenRevisionButton({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const { toast } = useToast(); const { t } = useI18n();
  const [pending, setPending] = useState(false);
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={async () => {
      setPending(true);
      const r = await openWorkflowRevisionAction(workflowId);
      setPending(false);
      if (r.ok) { toast({ kind: "success", title: t("wf.newRevisionOpened") }); router.refresh(); }
      else toast({ kind: "error", title: r.error });
    }}><GitBranch className="h-3.5 w-3.5" /> {t("wf.newRevision")}</Button>
  );
}

export function ArchiveWorkflowButton({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const { toast } = useToast(); const { t } = useI18n();
  const [pending, setPending] = useState(false);
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={async () => {
      setPending(true);
      const r = await archiveWorkflowAction(workflowId);
      setPending(false);
      if (r.ok) { toast({ kind: "success", title: t("wf.workflowArchived") }); router.push("/workflows"); }
      else toast({ kind: "error", title: r.error });
    }}><Archive className="h-3.5 w-3.5" /> {t("orgf.archive")}</Button>
  );
}
