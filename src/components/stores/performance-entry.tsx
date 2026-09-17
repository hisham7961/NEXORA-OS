"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { recordPerformanceAction } from "@/app/actions/stores";
import { useI18n } from "@/components/providers";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecordPerformanceButton({ storeId, currency }: { storeId: string; currency: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { t } = useI18n();
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("pe.record")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("pe.record")} description={t("pe.recordDesc", { currency })} width="620px">
        <ActionForm action={recordPerformanceAction} submitLabel={t("pe.savePerformance")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <input type="hidden" name="storeId" value={storeId} />
          <FormSection>
            <FormField label={t("pe.periodType")} name="periodType" required>
              <Select name="periodType" defaultValue="daily"><option value="daily">{t("pe.daily")}</option><option value="weekly">{t("pe.weekly")}</option><option value="monthly">{t("pe.monthly")}</option></Select>
            </FormField>
            <FormField label={t("pe.periodStart")} name="periodStart" required>
              <Input type="date" name="periodStart" defaultValue={today()} required />
            </FormField>
            <FormField label={t("pe.periodEnd")} name="periodEnd" hint={t("pe.periodEndHint")}>
              <Input type="date" name="periodEnd" />
            </FormField>
            <FormField label={t("pe.grossSales", { currency })} name="sales" hint={t("pe.beforeDiscounts")}>
              <Input type="number" step="0.001" min="0" name="sales" placeholder="0.000" />
            </FormField>
            <FormField label={t("pe.orders")} name="orders">
              <Input type="number" step="1" min="0" name="orders" placeholder="0" />
            </FormField>
            <FormField label={t("pe.unitsSold")} name="unitsSold">
              <Input type="number" step="1" min="0" name="unitsSold" placeholder="0" />
            </FormField>
            <FormField label={t("pe.returns")} name="returns">
              <Input type="number" step="1" min="0" name="returns" placeholder="0" />
            </FormField>
            <FormField label={t("pe.refunds", { currency })} name="refunds">
              <Input type="number" step="0.001" min="0" name="refunds" placeholder="0.000" />
            </FormField>
            <FormField label={t("pe.cogs", { currency })} name="cogs" hint={t("pe.forMargin")}>
              <Input type="number" step="0.001" min="0" name="cogs" placeholder="0.000" />
            </FormField>
            <FormField label={t("pe.adSpend", { currency })} name="adSpend">
              <Input type="number" step="0.001" min="0" name="adSpend" placeholder="0.000" />
            </FormField>
            <FormField label={t("pe.discounts", { currency })} name="discounts">
              <Input type="number" step="0.001" min="0" name="discounts" placeholder="0.000" />
            </FormField>
            <FormField label={t("pe.shippingCost", { currency })} name="shippingCost">
              <Input type="number" step="0.001" min="0" name="shippingCost" placeholder="0.000" />
            </FormField>
          </FormSection>
          <FormField label={t("common.notes")} name="notes">
            <Textarea name="notes" placeholder={t("pe.notesPlaceholder")} className="min-h-14" />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}
