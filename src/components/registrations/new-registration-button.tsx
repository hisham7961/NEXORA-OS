"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createRegistrationAction } from "@/app/actions/registrations";
import type { Option } from "@/domain/options";
import { useI18n } from "@/components/providers";

export function NewRegistrationButton({
  countries,
  brands,
  users,
  authorities,
}: {
  countries: Option[];
  brands: Option[];
  users: Option[];
  authorities: Option[];
}) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("reg.newCase")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("nrf.openRegCase")} description={t("nrf.openRegSub")}>
        <ActionForm action={createRegistrationAction} submitLabel={t("nrf.openCase")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <FormSection>
            <FormField label={t("common.market")} name="countryId" required>
              <Select name="countryId" defaultValue="" required><option value="">{t("nrf.selectDots")}</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </FormField>
            <FormField label={t("common.brand")} name="brandId">
              <Select name="brandId" defaultValue=""><option value="">—</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
            </FormField>
            <FormField label={t("reg.authority")} name="authorityId">
              <Select name="authorityId" defaultValue=""><option value="">—</option>{authorities.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select>
            </FormField>
            <FormField label={t("nrf.assignedTo")} name="assignedToId">
              <Select name="assignedToId" defaultValue=""><option value="">{t("campf.unassigned")}</option>{users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
            <FormField label={t("nrf.regNumber")} name="registrationNumber">
              <Input name="registrationNumber" placeholder={t("nrf.ifKnown")} />
            </FormField>
            <FormField label={t("nrf.agentDist")} name="agentName">
              <Input name="agentName" placeholder={t("nrf.localAgent")} />
            </FormField>
          </FormSection>
          <FormField label={t("camp.notes")} name="notes">
            <Textarea name="notes" placeholder={t("nrf.phContext")} />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}
