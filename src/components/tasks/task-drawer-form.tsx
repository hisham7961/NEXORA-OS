"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createTaskAction, updateTaskAction } from "@/app/actions/tasks";
import type { Option } from "@/domain/options";
import { useI18n } from "@/components/providers";

export interface TaskDefaults {
  id?: string;
  title?: string;
  description?: string | null;
  priority?: string;
  status?: string;
  startDate?: string | null; // yyyy-mm-dd
  dueDate?: string | null;
  brandId?: string | null;
  countryId?: string | null;
  companyId?: string | null;
  projectId?: string | null;
  ownerId?: string | null;
  assigneeIds?: string[];
  approvalRequired?: boolean;
}

const STATUSES = ["backlog", "todo", "in_progress", "blocked", "waiting", "review", "completed", "cancelled"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

function ChecklistInput() {
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const { t } = useI18n();
  const add = () => {
    const v = draft.trim();
    if (v) {
      setItems((x) => [...x, v]);
      setDraft("");
    }
  };
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="hidden" name="checklist" value={it} />
          <span className="flex-1 rounded-md bg-surface-2 px-2.5 py-1.5 text-[13px] text-ink">{it}</span>
          <button type="button" onClick={() => setItems((x) => x.filter((_, j) => j !== i))} className="text-ink-3 hover:text-critical" aria-label={t("taskf.remove")}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={t("taskf.phChecklistItem")} />
        <Button type="button" variant="secondary" size="sm" onClick={add}>{t("common.add")}</Button>
      </div>
    </div>
  );
}

function AssigneePicker({ users, selected }: { users: Option[]; selected: string[] }) {
  const { t } = useI18n();
  return (
    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-line p-2">
      {users.length === 0 && <p className="text-xs text-ink-3">{t("taskf.noUsers")}</p>}
      {users.map((u) => (
        <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-surface-2">
          <input type="checkbox" name="assigneeIds" value={u.id} defaultChecked={selected.includes(u.id)} className="accent-[var(--accent)]" />
          {u.label}
        </label>
      ))}
    </div>
  );
}

export function TaskDrawerForm({
  mode,
  options,
  defaults = {},
  label,
  variant = "primary",
  size = "md",
  icon = true,
}: {
  mode: "create" | "edit";
  options: { brands: Option[]; countries: Option[]; companies: Option[]; users: Option[]; projects: Option[] };
  defaults?: TaskDefaults;
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md";
  icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  useCreateShortcut(() => { if (mode === "create") setOpen(true); });
  const router = useRouter();
  const isEdit = mode === "edit";
  const action = isEdit ? updateTaskAction : createTaskAction;

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {icon && (isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
        {label ?? (isEdit ? t("actions.edit") : t("taskf.newTask"))}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={isEdit ? t("taskf.editTask") : t("taskf.newTask")} description={t("taskf.drawerSub")}>
        <ActionForm
          action={action}
          submitLabel={isEdit ? t("actions.saveChanges") : t("taskf.createTask")}
          onCancel={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        >
          {isEdit && <input type="hidden" name="id" value={defaults.id} />}
          <FormField label={t("taskf.title")} name="title" required>
            <Input name="title" defaultValue={defaults.title} placeholder={t("taskf.phTitle")} required />
          </FormField>
          <FormField label={t("common.description")} name="description">
            <Textarea name="description" defaultValue={defaults.description ?? ""} placeholder={t("taskf.phDescription")} />
          </FormField>

          <FormSection title={t("taskf.classification")}>
            <FormField label={t("common.priority")} name="priority">
              <Select name="priority" defaultValue={defaults.priority ?? "normal"}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
              </Select>
            </FormField>
            <FormField label={t("common.status")} name="status">
              <Select name="status" defaultValue={defaults.status ?? "todo"}>
                {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
              </Select>
            </FormField>
            <FormField label={t("orgf.startDate")} name="startDate">
              <Input type="date" name="startDate" defaultValue={defaults.startDate ?? ""} />
            </FormField>
            <FormField label={t("common.dueDate")} name="dueDate">
              <Input type="date" name="dueDate" defaultValue={defaults.dueDate ?? ""} />
            </FormField>
          </FormSection>

          <FormSection title={t("taskf.relationships")} description={t("taskf.relationshipsSub")}>
            <FormField label={t("common.brand")} name="brandId">
              <Select name="brandId" defaultValue={defaults.brandId ?? ""}>
                <option value="">—</option>
                {options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </Select>
            </FormField>
            <FormField label={t("common.market")} name="countryId">
              <Select name="countryId" defaultValue={defaults.countryId ?? ""}>
                <option value="">—</option>
                {options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </FormField>
            <FormField label={t("common.company")} name="companyId">
              <Select name="companyId" defaultValue={defaults.companyId ?? ""}>
                <option value="">—</option>
                {options.companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </FormField>
            <FormField label={t("taskf.project")} name="projectId">
              <Select name="projectId" defaultValue={defaults.projectId ?? ""}>
                <option value="">—</option>
                {options.projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </FormField>
            <FormField label={t("camp.owner")} name="ownerId">
              <Select name="ownerId" defaultValue={defaults.ownerId ?? ""}>
                <option value="">{t("taskf.me")}</option>
                {options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </Select>
            </FormField>
          </FormSection>

          <FormField label={t("taskf.assignees")} name="assigneeIds">
            <AssigneePicker users={options.users} selected={defaults.assigneeIds ?? []} />
          </FormField>

          {!isEdit && (
            <FormField label={t("taskf.checklist")} name="checklist">
              <ChecklistInput />
            </FormField>
          )}

          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" name="approvalRequired" defaultChecked={defaults.approvalRequired} className="accent-[var(--accent)]" />
            {t("taskf.requiresApproval")}
          </label>
        </ActionForm>
      </Drawer>
    </>
  );
}
