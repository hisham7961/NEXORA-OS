"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createChannelAction } from "@/app/actions/discussions";
import type { Option } from "@/domain/options";
import { useI18n } from "@/components/providers";

const TYPES = ["general", "brand", "company", "department", "campaign", "product", "project"];

export function NewChannelButton({ options }: { options: { brands: Option[]; countries: Option[]; companies: Option[] } }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={t("nc.newChannel")}><Plus className="h-4 w-4" /></button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("nc.newChannel")} description={t("nc.newChannelDesc")}>
        <ActionForm action={createChannelAction} submitLabel={t("nc.createChannel")} onCancel={() => setOpen(false)} onSuccess={(d) => { setOpen(false); const id = (d as { id?: string })?.id; if (id) router.push(`/discussions/${id}`); }}>
          <FormField label={t("common.name")} name="name" required><Input name="name" required placeholder="e.g. ramadan-campaign" /* i18n-ignore slug example */ /></FormField>
          <FormSection>
            <FormField label={t("common.type")} name="type"><Select name="type" defaultValue="general">{TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}</Select></FormField>
            <FormField label={t("common.brand")} name="brandId"><Select name="brandId" defaultValue=""><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
            <FormField label={t("common.market")} name="countryId"><Select name="countryId" defaultValue=""><option value="">—</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
          </FormSection>
          <FormField label={t("common.description")} name="description"><Textarea name="description" className="min-h-14" placeholder={t("nc.descPlaceholder")} /></FormField>
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" name="isPrivate" className="accent-[var(--accent)]" /> {t("nc.private")}
          </label>
        </ActionForm>
      </Drawer>
    </>
  );
}
