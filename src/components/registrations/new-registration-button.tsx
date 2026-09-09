"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createRegistrationAction } from "@/app/actions/registrations";
import type { Option } from "@/domain/options";

export function NewRegistrationButton({
  countries,
  brands,
  users,
  authorities,
}: {
  countries: Option[];
  brands: Option[];
  users: Option[];
  authorities: Option[];
}) {
  const [open, setOpen] = useState(false);
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New case</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Open registration case" description="Track a product registration through its authority workflow.">
        <ActionForm action={createRegistrationAction} submitLabel="Open case" onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <FormSection>
            <FormField label="Market" name="countryId" required>
              <Select name="countryId" defaultValue="" required><option value="">Select…</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </FormField>
            <FormField label="Brand" name="brandId">
              <Select name="brandId" defaultValue=""><option value="">—</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
            </FormField>
            <FormField label="Authority" name="authorityId">
              <Select name="authorityId" defaultValue=""><option value="">—</option>{authorities.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select>
            </FormField>
            <FormField label="Assigned to" name="assignedToId">
              <Select name="assignedToId" defaultValue=""><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
            <FormField label="Registration number" name="registrationNumber">
              <Input name="registrationNumber" placeholder="If already known" />
            </FormField>
            <FormField label="Agent / distributor" name="agentName">
              <Input name="agentName" placeholder="Local agent, if applicable" />
            </FormField>
          </FormSection>
          <FormField label="Notes" name="notes">
            <Textarea name="notes" placeholder="Context…" />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}
