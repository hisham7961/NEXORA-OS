"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createDesignAction, updateDesignAction } from "@/app/actions/design";
import type { Option } from "@/domain/options";
import { humanize } from "@/lib/status";

const ASSET_TYPES = ["post", "story", "reel", "banner", "packaging", "video", "print", "email", "web", "other"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

export interface DesignDefaults {
  id?: string;
  assetType?: string;
  brandId?: string | null;
  countryId?: string | null;
  companyId?: string | null;
  dimensions?: string | null;
  platform?: string | null;
  copy?: string | null;
  priority?: string;
  deadline?: string | null;
  designerId?: string | null;
  reviewerId?: string | null;
}

export function DesignForm({
  mode,
  options,
  defaults = {},
}: {
  mode: "create" | "edit";
  options: { brands: Option[]; countries: Option[]; companies: Option[]; users: Option[] };
  defaults?: DesignDefaults;
}) {
  const [open, setOpen] = useState(false);
  useCreateShortcut(() => { if (mode === "create") setOpen(true); });
  const router = useRouter();
  const isEdit = mode === "edit";
  return (
    <>
      <Button variant={isEdit ? "secondary" : "primary"} size={isEdit ? "sm" : "md"} onClick={() => setOpen(true)}>
        {isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {isEdit ? "Edit brief" : "New request"}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={isEdit ? "Edit design request" : "New design request"} description="Brief a creative request; versions are reviewed and approved without overwriting history." width="620px">
        <ActionForm action={isEdit ? updateDesignAction : createDesignAction} submitLabel={isEdit ? "Save" : "Create request"} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          {isEdit && <input type="hidden" name="requestId" value={defaults.id} />}
          <FormSection>
            <FormField label="Asset type" name="assetType" required>
              <Select name="assetType" defaultValue={defaults.assetType ?? "post"}>{ASSET_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select>
            </FormField>
            <FormField label="Priority" name="priority">
              <Select name="priority" defaultValue={defaults.priority ?? "normal"}>{PRIORITIES.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}</Select>
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
            <FormField label="Dimensions" name="dimensions">
              <Input name="dimensions" defaultValue={defaults.dimensions ?? ""} placeholder="e.g. 1080×1080" />
            </FormField>
            <FormField label="Platform" name="platform">
              <Input name="platform" defaultValue={defaults.platform ?? ""} placeholder="e.g. Instagram" />
            </FormField>
            <FormField label="Deadline" name="deadline">
              <Input type="date" name="deadline" defaultValue={defaults.deadline ?? ""} />
            </FormField>
            <FormField label="Designer" name="designerId">
              <Select name="designerId" defaultValue={defaults.designerId ?? ""}><option value="">Unassigned</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
            <FormField label="Reviewer" name="reviewerId">
              <Select name="reviewerId" defaultValue={defaults.reviewerId ?? ""}><option value="">—</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
          </FormSection>
          <FormField label="Copy / brief" name="copy">
            <Textarea name="copy" defaultValue={defaults.copy ?? ""} placeholder="What should this creative say and show?" />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}
