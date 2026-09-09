"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createWhatsappAction, updateWhatsappAction } from "@/app/actions/whatsapp";
import type { Option } from "@/domain/options";

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
  useCreateShortcut(() => { if (mode === "create") setOpen(true); });
  const router = useRouter();
  const isEdit = mode === "edit";
  return (
    <>
      <Button variant={isEdit ? "secondary" : "primary"} size={isEdit ? "sm" : "md"} onClick={() => setOpen(true)}>
        {isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {isEdit ? "Edit" : "New campaign"}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={isEdit ? "Edit WhatsApp campaign" : "New WhatsApp campaign"} description="Third-party executed — you run the internal brief → approval → sent → results workflow." width="600px">
        <ActionForm action={isEdit ? updateWhatsappAction : createWhatsappAction} submitLabel={isEdit ? "Save" : "Create"} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          {isEdit && <input type="hidden" name="waId" value={defaults.id} />}
          <FormField label="Objective" name="objective" required>
            <Input name="objective" defaultValue={defaults.objective ?? ""} placeholder="e.g. Eid offer blast" required />
          </FormField>
          <FormSection>
            {!isEdit && (
              <>
                <FormField label="Brand" name="brandId">
                  <Select name="brandId" defaultValue={defaults.brandId ?? ""}><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
                </FormField>
                <FormField label="Market" name="countryId">
                  <Select name="countryId" defaultValue={defaults.countryId ?? ""}><option value="">—</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
                </FormField>
              </>
            )}
            <FormField label="Audience" name="audience">
              <Input name="audience" defaultValue={defaults.audience ?? ""} placeholder="e.g. VIP customers, KW" />
            </FormField>
            <FormField label="Planned date" name="plannedDate">
              <Input type="date" name="plannedDate" defaultValue={defaults.plannedDate ?? ""} />
            </FormField>
            <FormField label="Responsible" name="responsibleUserId">
              <Select name="responsibleUserId" defaultValue={defaults.responsibleUserId ?? ""}><option value="">Unassigned</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
          </FormSection>
          <FormField label="Message copy" name="messageCopy">
            <Textarea name="messageCopy" defaultValue={defaults.messageCopy ?? ""} placeholder="The message to be sent…" />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}
