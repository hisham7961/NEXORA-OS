"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { createChannelAction } from "@/app/actions/discussions";
import type { Option } from "@/domain/options";

const TYPES = ["general", "brand", "company", "department", "campaign", "product", "project"];

export function NewChannelButton({ options }: { options: { brands: Option[]; countries: Option[]; companies: Option[] } }) {
  const [open, setOpen] = useState(false);
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="New channel"><Plus className="h-4 w-4" /></button>
      <Drawer open={open} onClose={() => setOpen(false)} title="New channel" description="A scoped space for structured work communication.">
        <ActionForm action={createChannelAction} submitLabel="Create channel" onCancel={() => setOpen(false)} onSuccess={(d) => { setOpen(false); const id = (d as { id?: string })?.id; if (id) router.push(`/discussions/${id}`); }}>
          <FormField label="Name" name="name" required><Input name="name" required placeholder="e.g. ramadan-campaign" /></FormField>
          <FormSection>
            <FormField label="Type" name="type"><Select name="type" defaultValue="general">{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></FormField>
            <FormField label="Brand" name="brandId"><Select name="brandId" defaultValue=""><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
            <FormField label="Market" name="countryId"><Select name="countryId" defaultValue=""><option value="">—</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
          </FormSection>
          <FormField label="Description" name="description"><Textarea name="description" className="min-h-14" placeholder="What is this channel for?" /></FormField>
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" name="isPrivate" className="accent-[var(--accent)]" /> Private (members only)
          </label>
        </ActionForm>
      </Drawer>
    </>
  );
}
