"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast, useI18n } from "@/components/providers";
import { assignRoleAction, removeAssignmentAction } from "@/app/actions/permissions";
import type { Option } from "@/domain/options";

export function AssignRoleButton({
  users,
  roles,
  brands,
  countries,
  companies,
}: {
  users: Option[];
  roles: Option[];
  brands: Option[];
  countries: Option[];
  companies: Option[];
}) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const router = useRouter();
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("sec.assignRole")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("sec.assignRoleTitle")} description={t("sec.assignRoleSub")}>
        <ActionForm action={assignRoleAction} submitLabel={t("sec.assign")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <FormSection>
            <FormField label={t("admin.col.user")} name="userId" required>
              <Select name="userId" defaultValue="" required><option value="">{t("sec.selectDots")}</option>{users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
            <FormField label={t("common.role")} name="roleId" required>
              <Select name="roleId" defaultValue="" required><option value="">{t("sec.selectDots")}</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</Select>
            </FormField>
            <FormField label={t("common.company")} name="companyId">
              <Select name="companyId" defaultValue=""><option value="">{t("sec.all")}</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </FormField>
            <FormField label={t("common.brand")} name="brandId">
              <Select name="brandId" defaultValue=""><option value="">{t("sec.all")}</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
            </FormField>
            <FormField label={t("common.country")} name="countryId">
              <Select name="countryId" defaultValue=""><option value="">{t("sec.all")}</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </FormField>
            <FormField label={t("sec.expires")} name="expiresAt" hint={t("sec.optional")}>
              <Input type="date" name="expiresAt" />
            </FormField>
          </FormSection>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function RemoveAssignmentButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      className="text-ink-3 hover:text-critical disabled:opacity-50"
      aria-label={t("sec.removeAssignment")}
      onClick={() =>
        start(async () => {
          const res = await removeAssignmentAction(assignmentId);
          if (res.ok) {
            toast({ kind: "success", title: t("sec.assignmentRemoved") });
            router.refresh();
          } else toast({ kind: "error", title: res.error });
        })
      }
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
