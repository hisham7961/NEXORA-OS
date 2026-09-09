"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createTaskAction, updateTaskAction } from "@/app/actions/tasks";
import type { Option } from "@/domain/options";

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
          <button type="button" onClick={() => setItems((x) => x.filter((_, j) => j !== i))} className="text-ink-3 hover:text-critical" aria-label="Remove">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Add a checklist item…" />
        <Button type="button" variant="secondary" size="sm" onClick={add}>Add</Button>
      </div>
    </div>
  );
}

function AssigneePicker({ users, selected }: { users: Option[]; selected: string[] }) {
  return (
    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-line p-2">
      {users.length === 0 && <p className="text-xs text-ink-3">No users available.</p>}
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
  const router = useRouter();
  const isEdit = mode === "edit";
  const action = isEdit ? updateTaskAction : createTaskAction;

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {icon && (isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
        {label ?? (isEdit ? "Edit" : "New task")}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={isEdit ? "Edit task" : "New task"} description="Fields, assignees and a checklist. Scope limits which brands/markets you can pick.">
        <ActionForm
          action={action}
          submitLabel={isEdit ? "Save changes" : "Create task"}
          onCancel={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        >
          {isEdit && <input type="hidden" name="id" value={defaults.id} />}
          <FormField label="Title" name="title" required>
            <Input name="title" defaultValue={defaults.title} placeholder="What needs to be done?" required />
          </FormField>
          <FormField label="Description" name="description">
            <Textarea name="description" defaultValue={defaults.description ?? ""} placeholder="Add detail, context, links…" />
          </FormField>

          <FormSection title="Classification">
            <FormField label="Priority" name="priority">
              <Select name="priority" defaultValue={defaults.priority ?? "normal"}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </FormField>
            <FormField label="Status" name="status">
              <Select name="status" defaultValue={defaults.status ?? "todo"}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </Select>
            </FormField>
            <FormField label="Start date" name="startDate">
              <Input type="date" name="startDate" defaultValue={defaults.startDate ?? ""} />
            </FormField>
            <FormField label="Due date" name="dueDate">
              <Input type="date" name="dueDate" defaultValue={defaults.dueDate ?? ""} />
            </FormField>
          </FormSection>

          <FormSection title="Relationships" description="Connect this task to the group's structure.">
            <FormField label="Brand" name="brandId">
              <Select name="brandId" defaultValue={defaults.brandId ?? ""}>
                <option value="">—</option>
                {options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Market" name="countryId">
              <Select name="countryId" defaultValue={defaults.countryId ?? ""}>
                <option value="">—</option>
                {options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Company" name="companyId">
              <Select name="companyId" defaultValue={defaults.companyId ?? ""}>
                <option value="">—</option>
                {options.companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Project" name="projectId">
              <Select name="projectId" defaultValue={defaults.projectId ?? ""}>
                <option value="">—</option>
                {options.projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Owner" name="ownerId">
              <Select name="ownerId" defaultValue={defaults.ownerId ?? ""}>
                <option value="">Me</option>
                {options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </Select>
            </FormField>
          </FormSection>

          <FormField label="Assignees" name="assigneeIds">
            <AssigneePicker users={options.users} selected={defaults.assigneeIds ?? []} />
          </FormField>

          {!isEdit && (
            <FormField label="Checklist" name="checklist">
              <ChecklistInput />
            </FormField>
          )}

          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" name="approvalRequired" defaultChecked={defaults.approvalRequired} className="accent-[var(--accent)]" />
            Requires approval before completion
          </label>
        </ActionForm>
      </Drawer>
    </>
  );
}
