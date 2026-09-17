"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createPublishingAction, updatePublishingAction, createRecurrenceAction } from "@/app/actions/social";
import type { Option } from "@/domain/options";
import { humanize } from "@/lib/status";
import { useI18n } from "@/components/providers";

const CONTENT_TYPES = ["post", "story", "reel", "video", "carousel", "live", "custom"];
const PLATFORMS = ["instagram", "facebook", "tiktok", "snapchat", "youtube", "x", "linkedin", "custom"];

export interface PublishingDefaults {
  id?: string;
  contentType?: string;
  platform?: string | null;
  brandId?: string | null;
  countryId?: string | null;
  ownerId?: string | null;
  designerId?: string | null;
  publishDate?: string | null;
  publishTime?: string | null;
  caption?: string | null;
  notes?: string | null;
}

export function PublishingForm({
  mode,
  options,
  defaults = {},
}: {
  mode: "create" | "edit";
  options: { brands: Option[]; countries: Option[]; users: Option[] };
  defaults?: PublishingDefaults;
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
        {isEdit ? t("actions.edit") : t("pub.planItem")}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={isEdit ? t("pub.editItem") : t("pub.planItemTitle")} description={t("pub.planSub")} width="600px">
        <ActionForm action={isEdit ? updatePublishingAction : createPublishingAction} submitLabel={isEdit ? t("common.save") : t("pub.planItem")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          {isEdit && <input type="hidden" name="itemId" value={defaults.id} />}
          <FormSection>
            <FormField label={t("pub.contentType")} name="contentType" required>
              <Select name="contentType" defaultValue={defaults.contentType ?? "post"}>{CONTENT_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select>
            </FormField>
            <FormField label={t("dp.platform")} name="platform">
              <Select name="platform" defaultValue={defaults.platform ?? ""}><option value="">—</option>{PLATFORMS.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}</Select>
            </FormField>
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
            <FormField label={t("pub.publishDate")} name="publishDate">
              <Input type="date" name="publishDate" defaultValue={defaults.publishDate ?? ""} />
            </FormField>
            <FormField label={t("pub.publishTime")} name="publishTime">
              <Input type="time" name="publishTime" defaultValue={defaults.publishTime ?? ""} />
            </FormField>
            <FormField label={t("camp.owner")} name="ownerId">
              <Select name="ownerId" defaultValue={defaults.ownerId ?? ""}><option value="">{t("campf.unassigned")}</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
            <FormField label={t("dp.designer")} name="designerId">
              <Select name="designerId" defaultValue={defaults.designerId ?? ""}><option value="">—</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
          </FormSection>
          <FormField label={t("pub.caption")} name="caption">
            <Textarea name="caption" defaultValue={defaults.caption ?? ""} placeholder={t("pub.phCaption")} />
          </FormField>
          <FormField label={t("camp.notes")} name="notes">
            <Textarea name="notes" defaultValue={defaults.notes ?? ""} className="min-h-14" placeholder={t("pub.phNotes")} />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function RecurrenceButton({ options }: { options: { brands: Option[]; countries: Option[]; users: Option[] } }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const router = useRouter();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("pub.recurringPlan")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("pub.recurringTitle")} description={t("pub.recurringSub")}>
        <ActionForm action={createRecurrenceAction} submitLabel={t("pub.generatePlan")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <FormSection>
            <FormField label={t("pub.contentType")} name="contentType" required>
              <Select name="contentType" defaultValue="story">{CONTENT_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select>
            </FormField>
            <FormField label={t("dp.platform")} name="platform">
              <Select name="platform" defaultValue=""><option value="">—</option>{PLATFORMS.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}</Select>
            </FormField>
            <FormField label={t("common.brand")} name="brandId">
              <Select name="brandId" defaultValue=""><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
            </FormField>
            <FormField label={t("common.market")} name="countryId">
              <Select name="countryId" defaultValue=""><option value="">—</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </FormField>
            <FormField label={t("orgf.startDate")} name="startDate" required>
              <Input type="date" name="startDate" required />
            </FormField>
            <FormField label={t("pub.numDays")} name="days" required hint="1–90">
              <Input type="number" name="days" min="1" max="90" defaultValue="7" required />
            </FormField>
            <FormField label={t("camp.owner")} name="ownerId">
              <Select name="ownerId" defaultValue=""><option value="">{t("campf.unassigned")}</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
          </FormSection>
        </ActionForm>
      </Drawer>
    </>
  );
}
