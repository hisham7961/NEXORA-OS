"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Archive } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast, useI18n } from "@/components/providers";
import { useCreateShortcut } from "@/lib/use-create-shortcut";
import type { ActionResult } from "@/lib/action";
import type { Option } from "@/domain/options";
import * as A from "@/app/actions/org";

type FormAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/** Generic create/edit drawer wrapper for an org entity. */
function OrgDrawer({ mode, title, createAction, editAction, listPath, children, id }: {
  mode: "create" | "edit"; title: string; createAction: FormAction; editAction: FormAction; listPath: string; id?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  useCreateShortcut(() => { if (mode === "create") setOpen(true); });
  const router = useRouter();
  const isEdit = mode === "edit";
  return (
    <>
      <Button variant={isEdit ? "secondary" : "primary"} size="sm" onClick={() => setOpen(true)}>{isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {isEdit ? t("actions.edit") : title}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={isEdit ? t("orgf.editPrefix", { name: title }) : title} width="560px">
        <ActionForm action={isEdit ? editAction : createAction} submitLabel={isEdit ? t("common.save") : t("common.create")} onCancel={() => setOpen(false)} onSuccess={(d) => { setOpen(false); if (!isEdit) { const nid = (d as { id?: string })?.id; router.push(nid ? `${listPath}/${nid}` : listPath); } else router.refresh(); }}>
          {isEdit && <input type="hidden" name="id" value={id} />}
          {children}
        </ActionForm>
      </Drawer>
    </>
  );
}

// ---- Company ----
export function CompanyForm({ mode, countries, defaults = {} }: { mode: "create" | "edit"; countries: Option[]; defaults?: Record<string, string | number | null | undefined> }) {
  const { t } = useI18n();
  return (
    <OrgDrawer mode={mode} title={t("orgf.newCompany")} createAction={A.createCompanyAction} editAction={A.updateCompanyAction} listPath="/companies" id={defaults.id as string}>
      <FormField label={t("common.name")} name="name" required><Input name="name" defaultValue={defaults.name as string} required /></FormField>
      <FormSection>
        <FormField label={t("common.code")} name="code" required><Input name="code" defaultValue={defaults.code as string} required placeholder="ACME" /></FormField>
        <FormField label={t("orgf.legalName")} name="legalName"><Input name="legalName" defaultValue={(defaults.legalName as string) ?? ""} /></FormField>
        <FormField label={t("orgf.baseCurrency")} name="baseCurrency"><Input name="baseCurrency" defaultValue={(defaults.baseCurrency as string) ?? "KWD"} maxLength={3} /></FormField>
        <FormField label={t("orgf.hqCountry")} name="hqCountryId"><Select name="hqCountryId" defaultValue={(defaults.hqCountryId as string) ?? ""}><option value="">—</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
        <FormField label={t("common.timezone")} name="timezone"><Input name="timezone" defaultValue={(defaults.timezone as string) ?? "Asia/Kuwait"} /></FormField>
        <FormField label={t("orgf.fiscalYearStartMonth")} name="fiscalYearStartMonth"><Input type="number" min="1" max="12" name="fiscalYearStartMonth" defaultValue={(defaults.fiscalYearStartMonth as number) ?? 1} /></FormField>
      </FormSection>
    </OrgDrawer>
  );
}

// ---- Brand ----
export function BrandForm({ mode, companies, defaults = {} }: { mode: "create" | "edit"; companies: Option[]; defaults?: Record<string, string | null | undefined> }) {
  const { t } = useI18n();
  return (
    <OrgDrawer mode={mode} title={t("orgf.newBrand")} createAction={A.createBrandAction} editAction={A.updateBrandAction} listPath="/brands" id={defaults.id ?? undefined}>
      <FormField label={t("common.name")} name="name" required><Input name="name" defaultValue={defaults.name ?? ""} required /></FormField>
      <FormSection>
        <FormField label={t("common.code")} name="code" required><Input name="code" defaultValue={defaults.code ?? ""} required placeholder="DERMA" /></FormField>
        <FormField label={t("orgf.slug")} name="slug" required hint={t("orgf.slugHint")}><Input name="slug" defaultValue={defaults.slug ?? ""} required placeholder="derma-plus" /></FormField>
        <FormField label={t("orgf.primaryCompany")} name="primaryCompanyId"><Select name="primaryCompanyId" defaultValue={defaults.primaryCompanyId ?? ""}><option value="">—</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
        <FormField label={t("orgf.accentColor")} name="accentColor"><Input name="accentColor" defaultValue={defaults.accentColor ?? ""} placeholder="#8b5cf6" /></FormField>
      </FormSection>
      <FormField label={t("common.description")} name="description"><Textarea name="description" defaultValue={defaults.description ?? ""} className="min-h-14" /></FormField>
    </OrgDrawer>
  );
}

// ---- Country / Market ----
export function CountryForm({ mode, defaults = {} }: { mode: "create" | "edit"; defaults?: Record<string, string | boolean | null | undefined> }) {
  const { t } = useI18n();
  return (
    <OrgDrawer mode={mode} title={t("orgf.newMarket")} createAction={A.createCountryAction} editAction={A.updateCountryAction} listPath="/markets" id={defaults.id as string}>
      <FormSection>
        <FormField label={t("common.name")} name="name" required><Input name="name" defaultValue={(defaults.name as string) ?? ""} required /></FormField>
        <FormField label={t("orgf.iso2")} name="iso2" required><Input name="iso2" defaultValue={(defaults.iso2 as string) ?? ""} required maxLength={2} placeholder="KW" /></FormField>
        <FormField label={t("orgf.iso3")} name="iso3"><Input name="iso3" defaultValue={(defaults.iso3 as string) ?? ""} maxLength={3} /></FormField>
        <FormField label={t("common.currency")} name="currency" required><Input name="currency" defaultValue={(defaults.currency as string) ?? ""} required maxLength={3} placeholder="KWD" /></FormField>
        <FormField label={t("orgf.region")} name="region"><Input name="region" defaultValue={(defaults.region as string) ?? ""} /></FormField>
        <FormField label={t("orgf.phoneCode")} name="phoneCode"><Input name="phoneCode" defaultValue={(defaults.phoneCode as string) ?? ""} placeholder="+965" /></FormField>
      </FormSection>
      <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" name="isActive" defaultChecked={defaults.isActive !== false} className="accent-[var(--accent)]" /> {t("orgf.activeMarket")}</label>
    </OrgDrawer>
  );
}

// ---- Department ----
export function DepartmentForm({ mode, companies, defaults = {} }: { mode: "create" | "edit"; companies: Option[]; defaults?: Record<string, string | null | undefined> }) {
  const { t } = useI18n();
  return (
    <OrgDrawer mode={mode} title={t("orgf.newDepartment")} createAction={A.createDepartmentAction} editAction={A.updateDepartmentAction} listPath="/teams" id={defaults.id ?? undefined}>
      <FormField label={t("common.name")} name="name" required><Input name="name" defaultValue={defaults.name ?? ""} required /></FormField>
      <FormSection>
        <FormField label={t("common.code")} name="code"><Input name="code" defaultValue={defaults.code ?? ""} /></FormField>
        <FormField label={t("common.company")} name="companyId"><Select name="companyId" defaultValue={defaults.companyId ?? ""}><option value="">—</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
      </FormSection>
      <FormField label={t("common.description")} name="description"><Textarea name="description" defaultValue={defaults.description ?? ""} className="min-h-12" /></FormField>
    </OrgDrawer>
  );
}

// ---- Team ----
export function TeamForm({ mode, brands, departments, users, defaults = {} }: { mode: "create" | "edit"; brands: Option[]; departments: Option[]; users: Option[]; defaults?: Record<string, string | null | undefined> }) {
  const { t } = useI18n();
  return (
    <OrgDrawer mode={mode} title={t("orgf.newTeam")} createAction={A.createTeamAction} editAction={A.updateTeamAction} listPath="/teams" id={defaults.id ?? undefined}>
      <FormField label={t("common.name")} name="name" required><Input name="name" defaultValue={defaults.name ?? ""} required /></FormField>
      <FormSection>
        <FormField label={t("orgf.department")} name="departmentId"><Select name="departmentId" defaultValue={defaults.departmentId ?? ""}><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</Select></FormField>
        <FormField label={t("common.brand")} name="brandId"><Select name="brandId" defaultValue={defaults.brandId ?? ""}><option value="">—</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
        <FormField label={t("orgf.teamLead")} name="leadUserId"><Select name="leadUserId" defaultValue={defaults.leadUserId ?? ""}><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select></FormField>
      </FormSection>
      <FormField label={t("common.description")} name="description"><Textarea name="description" defaultValue={defaults.description ?? ""} className="min-h-12" /></FormField>
    </OrgDrawer>
  );
}

// ---- Employee ----
export function EmployeeForm({ mode, users, companies, departments, teams, defaults = {} }: { mode: "create" | "edit"; users: Option[]; companies: Option[]; departments: Option[]; teams: Option[]; defaults?: Record<string, string | null | undefined> }) {
  const isEdit = mode === "edit";
  const { t } = useI18n();
  return (
    <OrgDrawer mode={mode} title={t("orgf.newEmployee")} createAction={A.createEmployeeAction} editAction={A.updateEmployeeAction} listPath="/employees" id={defaults.id ?? undefined}>
      {!isEdit && <FormField label={t("orgf.user")} name="userId" required hint={t("orgf.userHint")}><Select name="userId" defaultValue=""><option value="">{t("orgf.selectUser")}</option>{users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select></FormField>}
      <FormSection>
        <FormField label={t("orgf.position")} name="position"><Input name="position" defaultValue={defaults.position ?? ""} placeholder="Marketing Manager" /></FormField>
        <FormField label={t("common.company")} name="companyId"><Select name="companyId" defaultValue={defaults.companyId ?? ""}><option value="">—</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
        <FormField label={t("orgf.department")} name="departmentId"><Select name="departmentId" defaultValue={defaults.departmentId ?? ""}><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</Select></FormField>
        <FormField label={t("orgf.team")} name="teamId"><Select name="teamId" defaultValue={defaults.teamId ?? ""}><option value="">—</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select></FormField>
        <FormField label={t("orgf.joinDate")} name="joinDate"><Input type="date" name="joinDate" defaultValue={defaults.joinDate ?? ""} /></FormField>
      </FormSection>
    </OrgDrawer>
  );
}

// ---- Project ----
export function ProjectForm({ mode, brands, companies, users, defaults = {} }: { mode: "create" | "edit"; brands: Option[]; companies: Option[]; users: Option[]; defaults?: Record<string, string | null | undefined> }) {
  const { t } = useI18n();
  return (
    <OrgDrawer mode={mode} title={t("orgf.newProject")} createAction={A.createProjectAction} editAction={A.updateProjectAction} listPath="/projects" id={defaults.id ?? undefined}>
      <FormField label={t("common.name")} name="name" required><Input name="name" defaultValue={defaults.name ?? ""} required /></FormField>
      <FormSection>
        <FormField label={t("common.brand")} name="brandId"><Select name="brandId" defaultValue={defaults.brandId ?? ""}><option value="">—</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
        <FormField label={t("common.company")} name="companyId"><Select name="companyId" defaultValue={defaults.companyId ?? ""}><option value="">—</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
        <FormField label={t("orgf.owner")} name="ownerId"><Select name="ownerId" defaultValue={defaults.ownerId ?? ""}><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select></FormField>
        <FormField label={t("orgf.startDate")} name="startDate"><Input type="date" name="startDate" defaultValue={defaults.startDate ?? ""} /></FormField>
        <FormField label={t("common.dueDate")} name="dueDate"><Input type="date" name="dueDate" defaultValue={defaults.dueDate ?? ""} /></FormField>
      </FormSection>
      <FormField label={t("common.description")} name="description"><Textarea name="description" defaultValue={defaults.description ?? ""} className="min-h-12" /></FormField>
    </OrgDrawer>
  );
}

/** Generic archive button for org entities. */
export function ArchiveOrgButton({ kind, id, redirect }: { kind: "company" | "brand" | "team" | "employee" | "project" | "department"; id: string; redirect?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const fn = { company: A.archiveCompanyAction, brand: A.archiveBrandAction, team: A.archiveTeamAction, employee: A.archiveEmployeeAction, project: A.archiveProjectAction, department: A.archiveDepartmentAction }[kind];
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={async () => {
      setPending(true); const r = await fn(id); setPending(false);
      if (r.ok) { toast({ kind: "success", title: t("orgf.archived") }); if (redirect) router.push(redirect); else router.refresh(); }
      else toast({ kind: "error", title: r.error });
    }}><Archive className="h-3.5 w-3.5" /> {t("orgf.archive")}</Button>
  );
}
