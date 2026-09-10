"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button, Input, Textarea, Drawer } from "@/components/ui";
import { ActionForm, FormField } from "@/components/form/action-form";
import { createRoleAction, updateRoleAction } from "@/app/actions/permissions";
import { MODULES, SPECIAL_PERMISSIONS } from "@/lib/permissions/catalog";
import { useI18n } from "@/components/providers";

export interface RoleDefaults {
  id?: string;
  name?: string;
  description?: string | null;
  permissions?: string[];
}

export function RoleForm({ mode, defaults = {} }: { mode: "create" | "edit"; defaults?: RoleDefaults }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const router = useRouter();
  const isEdit = mode === "edit";
  const selected = new Set(defaults.permissions ?? []);

  return (
    <>
      <Button variant={isEdit ? "ghost" : "primary"} size={isEdit ? "sm" : "md"} onClick={() => setOpen(true)}>
        {isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {isEdit ? t("actions.edit") : t("sec.newRole")}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={isEdit ? t("sec.editRole") : t("sec.newRole")} description={t("sec.roleSub")} width="620px">
        <ActionForm action={isEdit ? updateRoleAction : createRoleAction} submitLabel={isEdit ? t("sec.saveRole") : t("sec.createRole")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          {isEdit && <input type="hidden" name="roleId" value={defaults.id} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t("common.name")} name="name" required>
              <Input name="name" defaultValue={defaults.name} required />
            </FormField>
            {!isEdit && (
              <FormField label={t("wf.key")} name="key" required hint={t("sec.keyHint")}>
                <Input name="key" placeholder="e.g. brand_manager" required />
              </FormField>
            )}
          </div>
          <FormField label={t("common.description")} name="description">
            <Textarea name="description" defaultValue={defaults.description ?? ""} className="min-h-14" />
          </FormField>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("sec.permissions")}</div>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-line p-3">
              {MODULES.map((m) => (
                <div key={m.key}>
                  <div className="mb-1 text-[12px] font-medium text-ink">{m.group} · {m.label}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {m.actions.map((a) => {
                      const key = `${m.key}.${a}`;
                      return (
                        <label key={key} className="flex items-center gap-1.5 text-[12px] text-ink-2">
                          <input type="checkbox" name="permissions" value={key} defaultChecked={selected.has(key)} className="accent-[var(--accent)]" />
                          {a}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div>
                <div className="mb-1 text-[12px] font-medium text-ink">{t("sec.sensitiveCaps")}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {SPECIAL_PERMISSIONS.map((key) => (
                    <label key={key} className="flex items-center gap-1.5 text-[12px] text-ink-2">
                      <input type="checkbox" name="permissions" value={key} defaultChecked={selected.has(key)} className="accent-[var(--accent)]" />
                      {key}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ActionForm>
      </Drawer>
    </>
  );
}
