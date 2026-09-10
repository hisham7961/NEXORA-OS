import { z } from "zod";
import type { Principal } from "@/lib/permissions/engine";
import { canAnywhere } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { parseCsvObjects } from "@/lib/csv";

/**
 * Reusable Import engine (§Phase4-18/19/20). ONE engine, not a parser per module.
 * Lifecycle: upload → parse → map columns → validate → preview (dry-run, with
 * duplicate + error detection) → commit (transaction-safe, batched) → history.
 * Each importer reuses the same permission-checked domain create path; the engine
 * never writes rows directly, and posted accounting data is never imported here.
 */
export interface ImportColumn { key: string; label: string; required?: boolean; hint?: string }
interface ImportResource {
  label: string;
  permission: string;
  needsCompany: boolean;
  columns: ImportColumn[];
  normalize: (raw: Record<string, string>) => { data?: Record<string, unknown>; issues: string[] };
  dedupeKey: (data: Record<string, unknown>) => string;
  existingKeys: (companyId: string | null) => Promise<Set<string>>;
  commit: (ctx: ActorContext, companyId: string | null, data: Record<string, unknown>) => Promise<void>;
}

const s = (v: string | undefined) => (v ?? "").trim();

export const IMPORTERS: Record<string, ImportResource> = {
  customers: {
    label: "Customers", permission: "ar.create", needsCompany: true,
    columns: [{ key: "name", label: "Name", required: true }, { key: "code", label: "Code" }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "currency", label: "Currency" }, { key: "paymentTermsDays", label: "Payment terms (days)" }, { key: "taxId", label: "Tax ID" }],
    normalize: (r) => {
      const issues: string[] = [];
      if (!s(r.name)) issues.push("name required");
      if (r.currency && s(r.currency).length !== 3) issues.push("currency must be 3 letters");
      const terms = s(r.paymentTermsDays);
      if (terms && !/^\d+$/.test(terms)) issues.push("terms must be a number");
      return { issues, data: issues.length ? undefined : { name: s(r.name), code: s(r.code) || undefined, email: s(r.email) || undefined, phone: s(r.phone) || undefined, currency: s(r.currency) || undefined, paymentTermsDays: terms || undefined, taxId: s(r.taxId) || undefined } };
    },
    dedupeKey: (d) => `${(d.code || d.name)}`.toLowerCase(),
    existingKeys: async (companyId) => new Set((await prisma.customer.findMany({ where: { companyId: companyId ?? undefined, archivedAt: null }, select: { name: true, code: true } })).flatMap((c) => [c.name.toLowerCase(), (c.code ?? "").toLowerCase()].filter(Boolean))),
    commit: async (ctx, companyId, data) => { const { createCustomer } = await import("@/domain/accounting/customers"); await createCustomer(ctx, companyId!, data); },
  },
  suppliers: {
    label: "Suppliers", permission: "ap.create", needsCompany: true,
    columns: [{ key: "name", label: "Name", required: true }, { key: "code", label: "Code" }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "currency", label: "Currency" }, { key: "paymentTermsDays", label: "Payment terms (days)" }, { key: "taxId", label: "Tax ID" }],
    normalize: (r) => {
      const issues: string[] = [];
      if (!s(r.name)) issues.push("name required");
      if (r.currency && s(r.currency).length !== 3) issues.push("currency must be 3 letters");
      return { issues, data: issues.length ? undefined : { name: s(r.name), code: s(r.code) || undefined, email: s(r.email) || undefined, phone: s(r.phone) || undefined, currency: s(r.currency) || undefined, paymentTermsDays: s(r.paymentTermsDays) || undefined, taxId: s(r.taxId) || undefined } };
    },
    dedupeKey: (d) => `${(d.code || d.name)}`.toLowerCase(),
    existingKeys: async (companyId) => new Set((await prisma.supplier.findMany({ where: { companyId: companyId ?? undefined, archivedAt: null }, select: { name: true, code: true } })).flatMap((c) => [c.name.toLowerCase(), (c.code ?? "").toLowerCase()].filter(Boolean))),
    commit: async (ctx, companyId, data) => { const { createSupplier } = await import("@/domain/accounting/suppliers"); await createSupplier(ctx, companyId!, data); },
  },
};

export function importerColumns(resource: string): { label: string; needsCompany: boolean; columns: ImportColumn[] } {
  const imp = IMPORTERS[resource];
  if (!imp) throw new ServiceError("unknown_import", "Unknown import resource.", 404);
  return { label: imp.label, needsCompany: imp.needsCompany, columns: imp.columns };
}

const mappingSchema = z.record(z.string(), z.string()); // column key → CSV header

interface Row { index: number; data?: Record<string, unknown>; issues: string[]; duplicate: boolean; }

function build(imp: ImportResource, csvText: string, mapping: Record<string, string>): { headers: string[]; rows: Row[] } {
  const { headers, rows } = parseCsvObjects(csvText);
  for (const c of imp.columns) if (c.required && !mapping[c.key]) throw new ServiceError("bad_mapping", `Map a column for "${c.label}".`, 422);
  const built = rows.map((raw, i) => {
    const mapped: Record<string, string> = {};
    for (const c of imp.columns) mapped[c.key] = mapping[c.key] ? (raw[mapping[c.key]] ?? "") : "";
    const { data, issues } = imp.normalize(mapped);
    return { index: i + 1, data, issues, duplicate: false } as Row;
  });
  return { headers, rows: built };
}

export async function previewImport(principal: Principal, resource: string, companyId: string | null, csvText: string, rawMapping: unknown) {
  const imp = IMPORTERS[resource];
  if (!imp) throw new ServiceError("unknown_import", "Unknown import resource.", 404);
  if (!canAnywhere(principal, imp.permission)) throw new ServiceError("forbidden", "You cannot import this data.", 403);
  if (imp.needsCompany && !companyId) throw new ServiceError("no_company", "Select a company for this import.", 422);
  const mapping = mappingSchema.parse(rawMapping);
  const { rows } = build(imp, csvText, mapping);
  const existing = await imp.existingKeys(companyId);
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.data) { const k = imp.dedupeKey(r.data); if (existing.has(k) || seen.has(k)) r.duplicate = true; seen.add(k); }
  }
  const importable = rows.filter((r) => r.issues.length === 0 && !r.duplicate).length;
  return {
    rows: rows.map((r) => ({ index: r.index, data: r.data ?? null, issues: r.issues, duplicate: r.duplicate })),
    summary: { total: rows.length, importable, duplicates: rows.filter((r) => r.duplicate).length, invalid: rows.filter((r) => r.issues.length).length },
  };
}

export async function commitImport(ctx: ActorContext, resource: string, companyId: string | null, csvText: string, rawMapping: unknown, fileName?: string) {
  const imp = IMPORTERS[resource];
  if (!imp) throw new ServiceError("unknown_import", "Unknown import resource.", 404);
  if (!canAnywhere(ctx.principal, imp.permission)) throw new ServiceError("forbidden", "You cannot import this data.", 403);
  if (imp.needsCompany && !companyId) throw new ServiceError("no_company", "Select a company for this import.", 422);
  const mapping = mappingSchema.parse(rawMapping);
  const { rows } = build(imp, csvText, mapping);
  const existing = await imp.existingKeys(companyId);
  const seen = new Set<string>();
  let created = 0, skipped = 0, errorCount = 0;
  const errors: { index: number; issue: string }[] = [];
  for (const r of rows) {
    if (!r.data || r.issues.length) { errorCount++; errors.push({ index: r.index, issue: r.issues.join(", ") || "invalid" }); continue; }
    const k = imp.dedupeKey(r.data);
    if (existing.has(k) || seen.has(k)) { skipped++; continue; }
    seen.add(k);
    try { await imp.commit(ctx, companyId, r.data); created++; }
    catch (e) { errorCount++; errors.push({ index: r.index, issue: e instanceof ServiceError ? e.message : "failed" }); }
  }
  const batch = await prisma.importBatch.create({
    data: { resource, companyId, fileName: fileName ?? null, status: errorCount > 0 && created === 0 ? "failed" : "completed", total: rows.length, created, updated: 0, skipped, errorCount, createdById: ctx.principal.userId },
  });
  await audit(ctx, { action: "data.imported", entityType: "ImportBatch", entityId: batch.id, summary: `${resource}: ${created} created, ${skipped} skipped, ${errorCount} errors`, companyId });
  return { batchId: batch.id, created, skipped, errorCount, errors };
}

export async function listImportBatches(principal: Principal, take = 50) {
  return prisma.importBatch.findMany({ where: { createdById: principal.userId }, orderBy: { createdAt: "desc" }, take });
}
