"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast } from "@/components/providers";
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
  const router = useRouter();
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Assign role</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Assign a role" description="Grant a role within a scope. Leave a scope empty for “all”.">
        <ActionForm action={assignRoleAction} submitLabel="Assign" onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <FormSection>
            <FormField label="User" name="userId" required>
              <Select name="userId" defaultValue="" required><option value="">Select…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
            <FormField label="Role" name="roleId" required>
              <Select name="roleId" defaultValue="" required><option value="">Select…</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</Select>
            </FormField>
            <FormField label="Company" name="companyId">
              <Select name="companyId" defaultValue=""><option value="">All</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </FormField>
            <FormField label="Brand" name="brandId">
              <Select name="brandId" defaultValue=""><option value="">All</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
            </FormField>
            <FormField label="Country" name="countryId">
              <Select name="countryId" defaultValue=""><option value="">All</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </FormField>
            <FormField label="Expires" name="expiresAt" hint="Optional">
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
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      className="text-ink-3 hover:text-critical disabled:opacity-50"
      aria-label="Remove assignment"
      onClick={() =>
        start(async () => {
          const res = await removeAssignmentAction(assignmentId);
          if (res.ok) {
            toast({ kind: "success", title: "Assignment removed" });
            router.refresh();
          } else toast({ kind: "error", title: res.error });
        })
      }
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
