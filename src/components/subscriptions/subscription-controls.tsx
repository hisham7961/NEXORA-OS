"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, RefreshCw, Ban, Archive } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast } from "@/components/providers";
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
  const router = useRouter();
  const isEdit = mode === "edit";
  return (
    <>
      <Button variant={isEdit ? "secondary" : "primary"} size="sm" onClick={() => setOpen(true)}>{isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {isEdit ? "Edit" : "New subscription"}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={isEdit ? "Edit subscription" : "New subscription"} description="Track recurring services. Never store passwords — only a payment-method reference." width="620px">
        <ActionForm action={isEdit ? updateSubscriptionAction : createSubscriptionAction} submitLabel={isEdit ? "Save" : "Create"} onCancel={() => setOpen(false)} onSuccess={(d) => { setOpen(false); if (!isEdit) { const id = (d as { id?: string })?.id; if (id) router.push(`/subscriptions/${id}`); } else router.refresh(); }}>
          {isEdit && <input type="hidden" name="subscriptionId" value={defaults.id} />}
          <FormField label="Provider" name="provider" required><Input name="provider" defaultValue={defaults.provider} required placeholder="e.g. Adobe, Shopify, AWS" /></FormField>
          <FormSection>
            <FormField label="Plan" name="plan"><Input name="plan" defaultValue={defaults.plan ?? ""} placeholder="e.g. Business" /></FormField>
            <FormField label="Owner" name="ownerId"><Select name="ownerId" defaultValue={defaults.ownerId ?? ""}><option value="">Unassigned</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select></FormField>
            {!isEdit && (
              <>
                <FormField label="Company" name="companyId"><Select name="companyId" defaultValue=""><option value="">—</option>{options.companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
                <FormField label="Brand" name="brandId"><Select name="brandId" defaultValue=""><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
              </>
            )}
            <FormField label="Cost" name="cost"><Input type="number" step="0.01" min="0" name="cost" defaultValue={defaults.cost ?? ""} placeholder="0.00" /></FormField>
            <FormField label="Currency" name="currency"><Input name="currency" defaultValue={defaults.currency ?? "USD"} maxLength={8} /></FormField>
            <FormField label="Billing cycle" name="billingCycle"><Select name="billingCycle" defaultValue={defaults.billingCycle ?? "monthly"}>{CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></FormField>
            <FormField label="Renewal date" name="renewalDate"><Input type="date" name="renewalDate" defaultValue={defaults.renewalDate ?? ""} /></FormField>
            <FormField label="Licenses" name="licenses"><Input type="number" min="0" name="licenses" defaultValue={defaults.licenses ?? ""} /></FormField>
            <FormField label="Payment method ref" name="paymentMethodRef" hint="Reference only — no card data"><Input name="paymentMethodRef" defaultValue={defaults.paymentMethodRef ?? ""} placeholder="e.g. Amex •1234" /></FormField>
          </FormSection>
          <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" name="autoRenew" defaultChecked={defaults.autoRenew ?? true} className="accent-[var(--accent)]" /> Auto-renews</label>
          <FormField label="Notes" name="notes"><Textarea name="notes" defaultValue={defaults.notes ?? ""} className="min-h-14" /></FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function SubscriptionActions({ subscriptionId, status }: { subscriptionId: string; status: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => { const r = await fn(); if (r.ok) { if (ok) toast({ kind: "success", title: ok }); router.refresh(); } else toast({ kind: "error", title: r.error ?? "Failed" }); });
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => renewSubscriptionAction(subscriptionId), "Renewed")}><RefreshCw className="h-3.5 w-3.5" /> Renew</Button>
      {status !== "cancelled" && <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => cancelSubscriptionAction(subscriptionId), "Cancelled")}><Ban className="h-3.5 w-3.5" /> Cancel</Button>}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => archiveSubscriptionAction(subscriptionId), "Archived")}><Archive className="h-3.5 w-3.5" /> Archive</Button>
    </div>
  );
}
