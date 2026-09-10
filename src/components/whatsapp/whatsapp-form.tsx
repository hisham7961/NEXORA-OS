"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createWhatsappAction, updateWhatsappAction } from "@/app/actions/whatsapp";
import type { Option } from "@/domain/options";
import { useI18n } from "@/components/providers";

export interface WhatsappDefaults {
  id?: string;
  brandId?: string | null;
  countryId?: string | null;
  audience?: string | null;
  objective?: string | null;
  messageCopy?: string | null;
  plannedDate?: string | null;
  responsibleUserId?: string | null;
}

export function WhatsappForm({
  mode,
  options,
  defaults = {},
}: {
  mode: "create" | "edit";
  options: { brands: Option[]; countries: Option[]; users: Option[] };
  defaults?: WhatsappDefaults;
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
      <Drawer open={open} onClose={() => setOpen(false)} title={isEdit ? t("waf.editWaCampaign") : t("waf.newWaCampaign")} description={t("waf.waSub")} width="600px">
        <ActionForm action={isEdit ? updateWhatsappAction : createWhatsappAction} submitLabel={isEdit ? t("common.save") : t("common.create")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          {isEdit && <input type="hidden" name="waId" value={defaults.id} />}
          <FormField label={t("camp.objective")} name="objective" required>
            <Input name="objective" defaultValue={defaults.objective ?? ""} placeholder={t("waf.phObjective")} required />
          </FormField>
          <FormSection>
            {!isEdit && (
              <>
                <FormField label={t("common.brand")} name="brandId">
                  <Select name="brandId" defaultValue={defaults.brandId ?? ""}><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
                </FormField>
                <FormField label={t("common.market")} name="countryId">
                  <Select name="countryId" defaultValue={defaults.countryId ?? ""}><option value="">—</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
                </FormField>
              </>
            )}
            <FormField label={t("waf.audience")} name="audience">
              <Input name="audience" defaultValue={defaults.audience ?? ""} placeholder={t("waf.phAudience")} />
            </FormField>
            <FormField label={t("waf.plannedDate")} name="plannedDate">
              <Input type="date" name="plannedDate" defaultValue={defaults.plannedDate ?? ""} />
            </FormField>
            <FormField label={t("waf.responsible")} name="responsibleUserId">
              <Select name="responsibleUserId" defaultValue={defaults.responsibleUserId ?? ""}><option value="">{t("campf.unassigned")}</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
          </FormSection>
          <FormField label={t("waf.messageCopy")} name="messageCopy">
            <Textarea name="messageCopy" defaultValue={defaults.messageCopy ?? ""} placeholder={t("waf.phMessage")} />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}
