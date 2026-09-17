"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createCaseAction } from "@/app/actions/cases";
import type { Option } from "@/domain/options";
import { useI18n } from "@/components/providers";
import { humanize } from "@/lib/status";

const TYPES = ["product_question", "complaint", "return", "refund", "damaged", "delivery", "wrong_item", "ecommerce", "ad_issue", "medical_info", "other"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

export function NewCaseButton({ options }: { options: { brands: Option[]; countries: Option[]; companies: Option[]; users: Option[] } }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("reg.newCase")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("nrf.newCustomerCase")} description={t("nrf.logCaseSub")}>
        <ActionForm action={createCaseAction} submitLabel={t("nrf.createCase")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <FormSection>
            <FormField label={t("common.type")} name="type" required>
              <Select name="type" defaultValue="product_question">{TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select>
            </FormField>
            <FormField label={t("common.priority")} name="priority">
              <Select name="priority" defaultValue="normal">{PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}</Select>
            </FormField>
            <FormField label={t("common.brand")} name="brandId">
              <Select name="brandId" defaultValue=""><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
            </FormField>
            <FormField label={t("common.market")} name="countryId">
              <Select name="countryId" defaultValue=""><option value="">—</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </FormField>
            <FormField label={t("nrf.orderRef")} name="orderRef">
              <Input name="orderRef" placeholder={t("nrf.phOrderRef")} />
            </FormField>
            <FormField label={t("nrf.customerRef")} name="customerRef">
              <Input name="customerRef" placeholder={t("nrf.phCustomerRef")} />
            </FormField>
            <FormField label={t("nrf.assignTo")} name="assignedToId">
              <Select name="assignedToId" defaultValue=""><option value="">{t("campf.unassigned")}</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
          </FormSection>
          <FormField label={t("common.description")} name="description">
            <Textarea name="description" placeholder={t("nrf.phCustomerIssue")} />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}
