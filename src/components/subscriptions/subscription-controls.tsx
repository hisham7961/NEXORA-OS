"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, RefreshCw, Ban, Archive } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast, useI18n } from "@/components/providers";
import { createSubscriptionAction, updateSubscriptionAction, renewSubscriptionAction, cancelSubscriptionAction, archiveSubscriptionAction } from "@/app/actions/subscriptions";
import type { Option } from "@/domain/options";

const CYCLES = ["monthly", "quarterly", "yearly", "custom"];

export interface SubDefaults {
  id?: string; provider?: string; plan?: string | null; companyId?: string | null; brandId?: string | null; countryId?: string | null;
  ownerId?: string | null; currency?: string; cost?: string | null; billingCycle?: string; renewalDate?: string | null;
  autoRenew?: boolean; paymentMethodRef?: string | null; licenses?: string | null; notes?: string | null;
}

export function SubscriptionForm({ mode, options, defaults = {} }: { mode: "create" | "edit"; options: { brands: Option[]; countries: Option[]; companies: Option[]; users: Option[] }; defaults?: SubDefaults }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  useCreateShortcut(() => { if (mode === "create") setOpen(true); });
  const router = useRouter();
  const isEdit = mode === "edit";
  return (
    <>
      <Button variant={isEdit ? "secondary" : "primary"} size="sm" onClick={() => setOpen(true)}>{isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {isEdit ? t("actions.edit") : t("subf.newSubscription")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={isEdit ? t("subf.editSubscription") : t("subf.newSubscription")} description={t("subf.subSub")} width="620px">
        <ActionForm action={isEdit ? updateSubscriptionAction : createSubscriptionAction} submitLabel={isEdit ? t("common.save") : t("common.create")} onCancel={() => setOpen(false)} onSuccess={(d) => { setOpen(false); if (!isEdit) { const id = (d as { id?: string })?.id; if (id) router.push(`/subscriptions/${id}`); } else router.refresh(); }}>
          {isEdit && <input type="hidden" name="subscriptionId" value={defaults.id} />}
          <FormField label={t("subf.provider")} name="provider" required><Input name="provider" defaultValue={defaults.provider} required placeholder={t("subf.phProvider")} /></FormField>
          <FormSection>
            <FormField label={t("subf.plan")} name="plan"><Input name="plan" defaultValue={defaults.plan ?? ""} placeholder={t("subf.phPlan")} /></FormField>
            <FormField label={t("camp.owner")} name="ownerId"><Select name="ownerId" defaultValue={defaults.ownerId ?? ""}><option value="">{t("campf.unassigned")}</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select></FormField>
            {!isEdit && (
              <>
                <FormField label={t("common.company")} name="companyId"><Select name="companyId" defaultValue=""><option value="">—</option>{options.companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
                <FormField label={t("common.brand")} name="brandId"><Select name="brandId" defaultValue=""><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
              </>
            )}
            <FormField label={t("subf.cost")} name="cost"><Input type="number" step="0.01" min="0" name="cost" defaultValue={defaults.cost ?? ""} placeholder="0.00" /></FormField>
            <FormField label={t("common.currency")} name="currency"><Input name="currency" defaultValue={defaults.currency ?? "USD"} maxLength={8} /></FormField>
            <FormField label={t("subf.billingCycle")} name="billingCycle"><Select name="billingCycle" defaultValue={defaults.billingCycle ?? "monthly"}>{CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></FormField>
            <FormField label={t("subf.renewalDate")} name="renewalDate"><Input type="date" name="renewalDate" defaultValue={defaults.renewalDate ?? ""} /></FormField>
            <FormField label={t("subf.licenses")} name="licenses"><Input type="number" min="0" name="licenses" defaultValue={defaults.licenses ?? ""} /></FormField>
            <FormField label={t("subf.paymentRef")} name="paymentMethodRef" hint={t("subf.paymentRefHint")}><Input name="paymentMethodRef" defaultValue={defaults.paymentMethodRef ?? ""} placeholder={t("subf.phPaymentRef")} /></FormField>
          </FormSection>
          <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" name="autoRenew" defaultChecked={defaults.autoRenew ?? true} className="accent-[var(--accent)]" /> {t("subf.autoRenews")}</label>
          <FormField label={t("camp.notes")} name="notes"><Textarea name="notes" defaultValue={defaults.notes ?? ""} className="min-h-14" /></FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function SubscriptionActions({ subscriptionId, status }: { subscriptionId: string; status: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => { const r = await fn(); if (r.ok) { if (ok) toast({ kind: "success", title: ok }); router.refresh(); } else toast({ kind: "error", title: r.error ?? t("ansf.failed") }); });
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => renewSubscriptionAction(subscriptionId), t("subf.renewed"))}><RefreshCw className="h-3.5 w-3.5" /> {t("subf.renew")}</Button>
      {status !== "cancelled" && <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => cancelSubscriptionAction(subscriptionId), t("subf.cancelled"))}><Ban className="h-3.5 w-3.5" /> {t("common.cancel")}</Button>}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => archiveSubscriptionAction(subscriptionId), t("orgf.archived"))}><Archive className="h-3.5 w-3.5" /> {t("orgf.archive")}</Button>
    </div>
  );
}
