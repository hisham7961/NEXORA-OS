"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { recordPerformanceAction } from "@/app/actions/stores";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecordPerformanceButton({ storeId, currency }: { storeId: string; currency: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Record performance</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Record performance" description={`Enter the figures for a period (in ${currency}). Margins are computed for you. Re-entering a period updates it.`} width="620px">
        <ActionForm action={recordPerformanceAction} submitLabel="Save performance" onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <input type="hidden" name="storeId" value={storeId} />
          <FormSection>
            <FormField label="Period type" name="periodType" required>
              <Select name="periodType" defaultValue="daily"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></Select>
            </FormField>
            <FormField label="Period start" name="periodStart" required>
              <Input type="date" name="periodStart" defaultValue={today()} required />
            </FormField>
            <FormField label="Period end" name="periodEnd" hint="Optional (weekly/monthly)">
              <Input type="date" name="periodEnd" />
            </FormField>
            <FormField label={`Gross sales (${currency})`} name="sales" hint="Before discounts & refunds">
              <Input type="number" step="0.001" min="0" name="sales" placeholder="0.000" />
            </FormField>
            <FormField label="Orders" name="orders">
              <Input type="number" step="1" min="0" name="orders" placeholder="0" />
            </FormField>
            <FormField label="Units sold" name="unitsSold">
              <Input type="number" step="1" min="0" name="unitsSold" placeholder="0" />
            </FormField>
            <FormField label="Returns" name="returns">
              <Input type="number" step="1" min="0" name="returns" placeholder="0" />
            </FormField>
            <FormField label={`Refunds (${currency})`} name="refunds">
              <Input type="number" step="0.001" min="0" name="refunds" placeholder="0.000" />
            </FormField>
            <FormField label={`COGS (${currency})`} name="cogs" hint="For gross margin">
              <Input type="number" step="0.001" min="0" name="cogs" placeholder="0.000" />
            </FormField>
            <FormField label={`Ad spend (${currency})`} name="adSpend">
              <Input type="number" step="0.001" min="0" name="adSpend" placeholder="0.000" />
            </FormField>
            <FormField label={`Discounts (${currency})`} name="discounts">
              <Input type="number" step="0.001" min="0" name="discounts" placeholder="0.000" />
            </FormField>
            <FormField label={`Shipping cost (${currency})`} name="shippingCost">
              <Input type="number" step="0.001" min="0" name="shippingCost" placeholder="0.000" />
            </FormField>
          </FormSection>
          <FormField label="Notes" name="notes">
            <Textarea name="notes" placeholder="Anything worth noting about this period…" className="min-h-14" />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}
