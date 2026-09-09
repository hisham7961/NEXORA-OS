"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createCampaignAction, updateCampaignAction } from "@/app/actions/campaigns";
import type { Option } from "@/domain/options";
import { humanize } from "@/lib/status";

const TYPES = ["meta", "instagram", "facebook", "tiktok", "snapchat", "google", "influencer", "whatsapp", "email", "offline", "retail", "custom"];

export interface CampaignDefaults {
  id?: string;
  name?: string;
  type?: string;
  objective?: string | null;
  brandId?: string | null;
  countryId?: string | null;
  companyId?: string | null;
  ownerId?: string | null;
  currency?: string;
  plannedBudget?: string | null;
  actualSpend?: string | null;
  targetAudience?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
}

export function CampaignDrawerForm({
  mode,
  options,
  defaults = {},
}: {
  mode: "create" | "edit";
  options: { brands: Option[]; countries: Option[]; companies: Option[]; users: Option[] };
  defaults?: CampaignDefaults;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = mode === "edit";

  return (
    <>
      <Button variant={isEdit ? "secondary" : "primary"} size={isEdit ? "sm" : "md"} onClick={() => setOpen(true)}>
        {isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {isEdit ? "Edit" : "New campaign"}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={isEdit ? "Edit campaign" : "New campaign"} description="Plan a campaign within your scope. Budget and metrics keep spend honest." width="620px">
        <ActionForm
          action={isEdit ? updateCampaignAction : createCampaignAction}
          submitLabel={isEdit ? "Save campaign" : "Create campaign"}
          onCancel={() => setOpen(false)}
          onSuccess={() => { setOpen(false); router.refresh(); }}
        >
          {isEdit && <input type="hidden" name="campaignId" value={defaults.id} />}
          <FormField label="Name" name="name" required>
            <Input name="name" defaultValue={defaults.name} placeholder="e.g. Ramadan skincare push" required />
          </FormField>
          <FormSection>
            <FormField label="Type" name="type" required>
              <Select name="type" defaultValue={defaults.type ?? "meta"}>{TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select>
            </FormField>
            <FormField label="Objective" name="objective">
              <Input name="objective" defaultValue={defaults.objective ?? ""} placeholder="e.g. Awareness, conversions" />
            </FormField>
            {!isEdit && (
              <>
                <FormField label="Company" name="companyId">
                  <Select name="companyId" defaultValue={defaults.companyId ?? ""}><option value="">—</option>{options.companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
                </FormField>
                <FormField label="Brand" name="brandId">
                  <Select name="brandId" defaultValue={defaults.brandId ?? ""}><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
                </FormField>
                <FormField label="Market" name="countryId">
                  <Select name="countryId" defaultValue={defaults.countryId ?? ""}><option value="">—</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
                </FormField>
              </>
            )}
            <FormField label="Owner" name="ownerId">
              <Select name="ownerId" defaultValue={defaults.ownerId ?? ""}><option value="">Unassigned</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
            <FormField label="Currency" name="currency">
              <Input name="currency" defaultValue={defaults.currency ?? "KWD"} maxLength={8} />
            </FormField>
            <FormField label="Planned budget" name="plannedBudget">
              <Input type="number" step="0.001" min="0" name="plannedBudget" defaultValue={defaults.plannedBudget ?? ""} placeholder="0.000" />
            </FormField>
            {isEdit && (
              <FormField label="Actual spend" name="actualSpend" hint="Auto-updates from logged spend metrics">
                <Input type="number" step="0.001" min="0" name="actualSpend" defaultValue={defaults.actualSpend ?? ""} placeholder="0.000" />
              </FormField>
            )}
            <FormField label="Start date" name="startDate">
              <Input type="date" name="startDate" defaultValue={defaults.startDate ?? ""} />
            </FormField>
            <FormField label="End date" name="endDate">
              <Input type="date" name="endDate" defaultValue={defaults.endDate ?? ""} />
            </FormField>
          </FormSection>
          <FormField label="Target audience" name="targetAudience">
            <Input name="targetAudience" defaultValue={defaults.targetAudience ?? ""} placeholder="Who is this for?" />
          </FormField>
          <FormField label="Notes" name="notes">
            <Textarea name="notes" defaultValue={defaults.notes ?? ""} placeholder="Brief, context, links…" />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}
