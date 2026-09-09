"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Archive, Trash2, Check } from "lucide-react";
import { Button, Input, Textarea, Select, Badge, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast } from "@/components/providers";
import { useCreateShortcut } from "@/lib/use-create-shortcut";
import {
  createProductAction, updateProductAction, archiveProductAction,
  addProductVariantAction, removeProductVariantAction, setProductMarketAction, removeProductMarketAction,
  addProductClaimAction, approveProductClaimAction, removeProductClaimAction,
} from "@/app/actions/products";
import type { Option } from "@/domain/options";

const STATUSES = ["active", "development", "discontinued", "archived"];

export interface ProductDefaults {
  id?: string; brandId?: string; name?: string; sku?: string; barcode?: string | null;
  category?: string | null; description?: string | null; status?: string; launchDate?: string | null;
}

export function ProductForm({ mode, brands, defaults = {} }: { mode: "create" | "edit"; brands: Option[]; defaults?: ProductDefaults }) {
  const [open, setOpen] = useState(false);
  useCreateShortcut(() => { if (mode === "create") setOpen(true); });
  const router = useRouter();
  const isEdit = mode === "edit";
  return (
    <>
      <Button variant={isEdit ? "secondary" : "primary"} size="sm" onClick={() => setOpen(true)}>{isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {isEdit ? "Edit" : "New product"}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={isEdit ? "Edit product" : "New product"} description="Master product record. SKU must be unique across the group." width="580px">
        <ActionForm action={isEdit ? updateProductAction : createProductAction} submitLabel={isEdit ? "Save" : "Create"} onCancel={() => setOpen(false)} onSuccess={(d) => { setOpen(false); if (!isEdit) { const id = (d as { id?: string })?.id; if (id) router.push(`/products/${id}`); } else router.refresh(); }}>
          {isEdit && <input type="hidden" name="productId" value={defaults.id} />}
          <FormField label="Name" name="name" required><Input name="name" defaultValue={defaults.name} required placeholder="e.g. Hydra Serum 30ml" /></FormField>
          <FormSection>
            <FormField label="Brand" name="brandId" required><Select name="brandId" defaultValue={defaults.brandId ?? ""} required><option value="">Select brand…</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
            <FormField label="SKU" name="sku" required><Input name="sku" defaultValue={defaults.sku} required placeholder="HS-030" /></FormField>
            <FormField label="Barcode" name="barcode"><Input name="barcode" defaultValue={defaults.barcode ?? ""} placeholder="EAN/UPC" /></FormField>
            <FormField label="Category" name="category"><Input name="category" defaultValue={defaults.category ?? ""} placeholder="Skincare" /></FormField>
            <FormField label="Status" name="status"><Select name="status" defaultValue={defaults.status ?? "active"}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></FormField>
            <FormField label="Launch date" name="launchDate"><Input type="date" name="launchDate" defaultValue={defaults.launchDate ?? ""} /></FormField>
          </FormSection>
          <FormField label="Description" name="description"><Textarea name="description" defaultValue={defaults.description ?? ""} className="min-h-16" /></FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function ArchiveProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={async () => {
      setPending(true);
      const r = await archiveProductAction(productId);
      setPending(false);
      if (r.ok) { toast({ kind: "success", title: "Product archived" }); router.push("/products"); }
      else toast({ kind: "error", title: r.error });
    }}><Archive className="h-3.5 w-3.5" /> Archive</Button>
  );
}

/** Compact editors for variants, markets and claims on the Product 360 page. */
export function ProductVariants({ productId, variants, editable }: { productId: string; variants: { id: string; name: string; sku: string | null; size: string | null }[]; editable: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(""); const [sku, setSku] = useState(""); const [size, setSize] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (r.ok) router.refresh(); else toast({ kind: "error", title: r.error ?? "Failed" }); });
  return (
    <div className="space-y-2">
      {variants.length === 0 ? <p className="text-[13px] text-ink-3">No variants.</p> : (
        <ul className="divide-y divide-line">
          {variants.map((v) => (
            <li key={v.id} className="flex items-center gap-2 py-1.5 text-[13px]">
              <span className="flex-1 text-ink">{v.name}{v.size ? ` · ${v.size}` : ""}{v.sku ? ` · ${v.sku}` : ""}</span>
              {editable && <button className="rounded p-1 text-ink-3 hover:text-critical" disabled={pending} onClick={() => run(() => removeProductVariantAction(productId, v.id))}><Trash2 className="h-3.5 w-3.5" /></button>}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Variant name" className="max-w-[160px]" />
          <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Size" className="max-w-[90px]" />
          <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" className="max-w-[110px]" />
          <Button size="sm" variant="secondary" disabled={pending || !name.trim()} onClick={() => run(async () => { const r = await addProductVariantAction(productId, name.trim(), sku || undefined, size || undefined); if (r.ok) { setName(""); setSku(""); setSize(""); } return r; })}><Plus className="h-3.5 w-3.5" /> Add</Button>
        </div>
      )}
    </div>
  );
}

const MARKET_STATUS = ["planned", "active", "paused", "withdrawn"];

export function ProductMarkets({ productId, markets, countries, editable }: { productId: string; markets: { countryId: string; status: string }[]; countries: Option[]; editable: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [country, setCountry] = useState(""); const [status, setStatus] = useState("planned");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (r.ok) router.refresh(); else toast({ kind: "error", title: r.error ?? "Failed" }); });
  const name = (id: string) => countries.find((c) => c.id === id)?.label ?? id;
  return (
    <div className="space-y-2">
      {markets.length === 0 ? <p className="text-[13px] text-ink-3">No markets.</p> : (
        <ul className="divide-y divide-line">
          {markets.map((m) => (
            <li key={m.countryId} className="flex items-center gap-2 py-1.5 text-[13px]">
              <span className="flex-1 text-ink">{name(m.countryId)}</span>
              <Badge category={m.status === "active" ? "success" : m.status === "withdrawn" ? "critical" : "neutral"}>{m.status}</Badge>
              {editable && <button className="rounded p-1 text-ink-3 hover:text-critical" disabled={pending} onClick={() => run(() => removeProductMarketAction(productId, m.countryId))}><Trash2 className="h-3.5 w-3.5" /></button>}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <Select value={country} onChange={(e) => setCountry(e.target.value)} className="max-w-[160px]"><option value="">Country…</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[120px]">{MARKET_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
          <Button size="sm" variant="secondary" disabled={pending || !country} onClick={() => run(async () => { const r = await setProductMarketAction(productId, country, status); if (r.ok) setCountry(""); return r; })}><Plus className="h-3.5 w-3.5" /> Set</Button>
        </div>
      )}
    </div>
  );
}

export function ProductClaims({ productId, claims, countries, editable, canApprove }: { productId: string; claims: { id: string; claim: string; countryId: string | null; isApproved: boolean }[]; countries: Option[]; editable: boolean; canApprove: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [claim, setClaim] = useState(""); const [country, setCountry] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (r.ok) router.refresh(); else toast({ kind: "error", title: r.error ?? "Failed" }); });
  const name = (id: string | null) => (id ? countries.find((c) => c.id === id)?.label ?? id : "All markets");
  return (
    <div className="space-y-2">
      {claims.length === 0 ? <p className="text-[13px] text-ink-3">No claims recorded.</p> : (
        <ul className="divide-y divide-line">
          {claims.map((c) => (
            <li key={c.id} className="flex items-start gap-2 py-1.5 text-[13px]">
              <span className="flex-1 text-ink">{c.claim}<span className="ms-1 text-[11px] text-ink-3">· {name(c.countryId)}</span></span>
              <Badge category={c.isApproved ? "success" : "warning"}>{c.isApproved ? "approved" : "draft"}</Badge>
              {canApprove && !c.isApproved && <button className="rounded p-1 text-ink-3 hover:text-success" disabled={pending} onClick={() => run(() => approveProductClaimAction(productId, c.id))}><Check className="h-3.5 w-3.5" /></button>}
              {editable && <button className="rounded p-1 text-ink-3 hover:text-critical" disabled={pending} onClick={() => run(() => removeProductClaimAction(productId, c.id))}><Trash2 className="h-3.5 w-3.5" /></button>}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <Input value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="Marketing claim…" className="min-w-[200px] flex-1" />
          <Select value={country} onChange={(e) => setCountry(e.target.value)} className="max-w-[150px]"><option value="">All markets</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
          <Button size="sm" variant="secondary" disabled={pending || !claim.trim()} onClick={() => run(async () => { const r = await addProductClaimAction(productId, claim.trim(), country || undefined); if (r.ok) { setClaim(""); setCountry(""); } return r; })}><Plus className="h-3.5 w-3.5" /> Add</Button>
        </div>
      )}
    </div>
  );
}
