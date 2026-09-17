"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createCampaignAction, updateCampaignAction } from "@/app/actions/campaigns";
import type { Option } from "@/domain/options";
import { humanize } from "@/lib/status";
import { useI18n } from "@/components/providers";

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
  const { t } = useI18n();
  useCreateShortcut(() => { if (mode === "create") setOpen(true); });
  const router = useRouter();
  const isEdit = mode === "edit";

  return (
    <>
      <Button variant={isEdit ? "secondary" : "primary"} size={isEdit ? "sm" : "md"} onClick={() => setOpen(true)}>
        {isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {isEdit ? t("actions.edit") : t("campf.newCampaign")}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={isEdit ? t("campf.editCampaign") : t("campf.newCampaign")} description={t("campf.drawerSub")} width="620px">
        <ActionForm
          action={isEdit ? updateCampaignAction : createCampaignAction}
          submitLabel={isEdit ? t("campf.saveCampaign") : t("campf.createCampaign")}
          onCancel={() => setOpen(false)}
          onSuccess={() => { setOpen(false); router.refresh(); }}
        >
          {isEdit && <input type="hidden" name="campaignId" value={defaults.id} />}
          <FormField label={t("common.name")} name="name" required>
            <Input name="name" defaultValue={defaults.name} placeholder={t("campf.phName")} required />
          </FormField>
          <FormSection>
            <FormField label={t("common.type")} name="type" required>
              <Select name="type" defaultValue={defaults.type ?? "meta"}>{TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select>
            </FormField>
            <FormField label={t("camp.objective")} name="objective">
              <Input name="objective" defaultValue={defaults.objective ?? ""} placeholder={t("campf.phObjective")} />
            </FormField>
            {!isEdit && (
              <>
                <FormField label={t("common.company")} name="companyId">
                  <Select name="companyId" defaultValue={defaults.companyId ?? ""}><option value="">—</option>{options.companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
                </FormField>
                <FormField label={t("common.brand")} name="brandId">
                  <Select name="brandId" defaultValue={defaults.brandId ?? ""}><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
                </FormField>
                <FormField label={t("common.market")} name="countryId">
                  <Select name="countryId" defaultValue={defaults.countryId ?? ""}><option value="">—</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
                </FormField>
              </>
            )}
            <FormField label={t("camp.owner")} name="ownerId">
              <Select name="ownerId" defaultValue={defaults.ownerId ?? ""}><option value="">{t("campf.unassigned")}</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
            <FormField label={t("common.currency")} name="currency">
              <Input name="currency" defaultValue={defaults.currency ?? "KWD"} maxLength={8} />
            </FormField>
            <FormField label={t("camp.plannedBudget")} name="plannedBudget" hint={isEdit ? t("campf.plannedBudgetHint") : undefined}>
              <Input type="number" step="0.001" min="0" name="plannedBudget" defaultValue={defaults.plannedBudget ?? ""} placeholder="0.000" />
            </FormField>
            <FormField label={t("orgf.startDate")} name="startDate">
              <Input type="date" name="startDate" defaultValue={defaults.startDate ?? ""} />
            </FormField>
            <FormField label={t("camp.end")} name="endDate">
              <Input type="date" name="endDate" defaultValue={defaults.endDate ?? ""} />
            </FormField>
          </FormSection>
          <FormField label={t("camp.targetAudience")} name="targetAudience">
            <Input name="targetAudience" defaultValue={defaults.targetAudience ?? ""} placeholder={t("campf.phAudience")} />
          </FormField>
          <FormField label={t("camp.notes")} name="notes">
            <Textarea name="notes" defaultValue={defaults.notes ?? ""} placeholder={t("campf.phNotes")} />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}
