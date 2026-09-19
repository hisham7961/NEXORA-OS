"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useCreateShortcut } from "@/lib/use-create-shortcut";
import { createExpenseAction } from "@/app/actions/expenses";
import { useI18n } from "@/components/providers";
import type { Option } from "@/domain/options";

type Category = { id: string; name: string };

/**
 * File a new expense (audit DOM-06). The claimant enters amount + category + scope;
 * it is filed as `pending` for approval. GL posting stays a separate approval-gated
 * step, so this form never touches the ledger.
 */
export function NewExpenseButton({
  companies,
  brands,
  countries,
  categories,
}: {
  companies: Option[];
  brands: Option[];
  countries: Option[];
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> {t("expf.newExpense")}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("expf.drawerTitle")} description={t("expf.drawerSub")}>
        <ActionForm
          action={createExpenseAction}
          submitLabel={t("expf.submit")}
          onCancel={() => setOpen(false)}
          onSuccess={() => { setOpen(false); router.refresh(); }}
        >
          <FormField label={t("expf.description")} name="description" required>
            <Input name="description" required placeholder={t("expf.descriptionPh")} />
          </FormField>
          <FormSection>
            <FormField label={t("expf.amount")} name="amount" required>
              <Input type="number" name="amount" step="0.001" min="0" required />
            </FormField>
            <FormField label={t("expf.currency")} name="currency">
              <Input name="currency" defaultValue="KWD" maxLength={3} />
            </FormField>
            <FormField label={t("expf.date")} name="date" required>
              <Input type="date" name="date" required defaultValue={today} />
            </FormField>
            <FormField label={t("expf.taxAmount")} name="taxAmount">
              <Input type="number" name="taxAmount" step="0.001" min="0" />
            </FormField>
            <FormField label={t("expf.category")} name="categoryId">
              <Select name="categoryId" defaultValue="">
                <option value="">{t("expf.selectCategory")}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>
            <FormField label={t("common.company")} name="companyId">
              <Select name="companyId" defaultValue=""><option value="">—</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </FormField>
            <FormField label={t("common.brand")} name="brandId">
              <Select name="brandId" defaultValue=""><option value="">—</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
            </FormField>
            <FormField label={t("common.market")} name="countryId">
              <Select name="countryId" defaultValue=""><option value="">—</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </FormField>
          </FormSection>
        </ActionForm>
      </Drawer>
    </>
  );
}
