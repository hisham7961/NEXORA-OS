"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createCaseAction } from "@/app/actions/cases";
import type { Option } from "@/domain/options";
import { humanize } from "@/lib/status";

const TYPES = ["product_question", "complaint", "return", "refund", "damaged", "delivery", "wrong_item", "ecommerce", "ad_issue", "medical_info", "other"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

export function NewCaseButton({ options }: { options: { brands: Option[]; countries: Option[]; companies: Option[]; users: Option[] } }) {
  const [open, setOpen] = useState(false);
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New case</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="New customer case" description="Log a case within your scope.">
        <ActionForm action={createCaseAction} submitLabel="Create case" onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <FormSection>
            <FormField label="Type" name="type" required>
              <Select name="type" defaultValue="product_question">{TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select>
            </FormField>
            <FormField label="Priority" name="priority">
              <Select name="priority" defaultValue="normal">{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
            </FormField>
            <FormField label="Brand" name="brandId">
              <Select name="brandId" defaultValue=""><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
            </FormField>
            <FormField label="Market" name="countryId">
              <Select name="countryId" defaultValue=""><option value="">—</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </FormField>
            <FormField label="Order reference" name="orderRef">
              <Input name="orderRef" placeholder="e.g. #10234" />
            </FormField>
            <FormField label="Customer reference" name="customerRef">
              <Input name="customerRef" placeholder="Name / phone / email" />
            </FormField>
            <FormField label="Assign to" name="assignedToId">
              <Select name="assignedToId" defaultValue=""><option value="">Unassigned</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
          </FormSection>
          <FormField label="Description" name="description">
            <Textarea name="description" placeholder="What is the customer's issue?" />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}
