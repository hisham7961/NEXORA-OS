import type { Principal } from "@/lib/permissions/engine";
import { canAnywhere } from "@/lib/permissions/engine";
import { ServiceError } from "@/lib/api/handler";
import { audit, type ActorContext } from "@/domain/mutation";
import { toCsv } from "@/lib/csv";

/**
 * Export registry (§Phase4-17). A list/report screen exports via a registered
 * exporter that REUSES the same permission-checked, scope-filtered domain function
 * as the on-screen list. No exporter runs raw SQL or bypasses scope; sensitive
 * financial exports are audited. Everything renders to CSV through src/lib/csv.
 */
export interface ExportResult { headers: string[]; rows: (string | number)[][]; filename: string }
interface Exporter {
  permission: string;
  audit?: boolean;
  run: (principal: Principal, params: URLSearchParams) => Promise<ExportResult>;
}

const num = (v: unknown) => (v == null ? "" : Number(v));
const str = (v: unknown) => (v == null ? "" : String(v));

/**
 * Page through a list service (max 200 rows/page — the same UI ceiling) until the
 * dataset is exhausted or a hard safety cap is hit, so exports are never truncated
 * to a single page. Reuses the same permission-checked, scope-filtered domain query.
 */
const EXPORT_PAGE = 200;
const EXPORT_CAP = 50000;
async function collectAll<T>(fetch: (page: number, pageSize: number) => Promise<{ rows: T[] }>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; ; page++) {
    const { rows } = await fetch(page, EXPORT_PAGE);
    out.push(...rows);
    if (rows.length < EXPORT_PAGE || out.length >= EXPORT_CAP) break;
  }
  return out;
}

async function companyParam(principal: Principal, params: URLSearchParams): Promise<string> {
  const { resolveAccountingCompany } = await import("@/domain/accounting/access");
  const { current } = await resolveAccountingCompany(principal, params.get("company") ?? undefined);
  if (!current) throw new ServiceError("no_company", "No accessible company.", 422);
  return current.id;
}

export const EXPORTERS: Record<string, Exporter> = {
  products: {
    permission: "products.view",
    run: async (principal, params) => {
      const { listProducts, productQuerySchema } = await import("@/domain/products");
      const base = Object.fromEntries(params);
      const rows = await collectAll((page, pageSize) => listProducts(principal, productQuerySchema.parse({ ...base, page, pageSize })));
      return { filename: "products", headers: ["Name", "SKU", "Brand", "Status"], rows: rows.map((p) => [str(p.name), str(p.sku), str(p.brandId), str(p.status)]) };
    },
  },
  customers: {
    permission: "ar.view",
    run: async (principal, params) => {
      const { listCustomers } = await import("@/domain/accounting/customers");
      const companyId = await companyParam(principal, params);
      const rows = await collectAll((page, pageSize) => listCustomers(principal, companyId, { active: "all", page, pageSize }));
      return { filename: "customers", headers: ["Name", "Code", "Email", "Phone", "Currency", "Terms", "Active"], rows: rows.map((c) => [str(c.name), str(c.code), str(c.email), str(c.phone), str(c.currency), num(c.paymentTermsDays), c.isActive ? "yes" : "no"]) };
    },
  },
  suppliers: {
    permission: "ap.view",
    run: async (principal, params) => {
      const { listSuppliers } = await import("@/domain/accounting/suppliers");
      const companyId = await companyParam(principal, params);
      const rows = await collectAll((page, pageSize) => listSuppliers(principal, companyId, { active: "all", page, pageSize }));
      return { filename: "suppliers", headers: ["Name", "Code", "Email", "Phone", "Currency", "Terms", "Active"], rows: rows.map((s) => [str(s.name), str(s.code), str(s.email), str(s.phone), str(s.currency), num(s.paymentTermsDays), s.isActive ? "yes" : "no"]) };
    },
  },
  invoices: {
    permission: "ar.view", audit: true,
    run: async (principal, params) => {
      const { listInvoices } = await import("@/domain/accounting/ar");
      const companyId = await companyParam(principal, params);
      const rows = await collectAll((page, pageSize) => listInvoices(principal, companyId, { page, pageSize }));
      return { filename: "sales-invoices", headers: ["Number", "Customer", "Issue date", "Due date", "Currency", "Total", "Balance due", "Status"], rows: rows.map((i) => [str(i.invoiceNumber), str(i.customer.name), str(i.issueDate?.toISOString?.().slice(0, 10)), str(i.dueDate ? i.dueDate.toISOString().slice(0, 10) : ""), str(i.currency), num(i.total), num(i.amountDue), str(i.status)]) };
    },
  },
  bills: {
    permission: "ap.view", audit: true,
    run: async (principal, params) => {
      const { listBills } = await import("@/domain/accounting/ap");
      const companyId = await companyParam(principal, params);
      const rows = await collectAll((page, pageSize) => listBills(principal, companyId, { page, pageSize }));
      return { filename: "supplier-bills", headers: ["Number", "Supplier", "Issue date", "Due date", "Currency", "Total", "Balance due", "Status"], rows: rows.map((b) => [str(b.billNumber), str(b.supplier.name), str(b.issueDate?.toISOString?.().slice(0, 10)), str(b.dueDate ? b.dueDate.toISOString().slice(0, 10) : ""), str(b.currency), num(b.total), num(b.amountDue), str(b.status)]) };
    },
  },
  "trial-balance": {
    permission: "accounting.view", audit: true,
    run: async (principal, params) => {
      const { trialBalance } = await import("@/domain/accounting/reports");
      const companyId = await companyParam(principal, params);
      const tb = await trialBalance(principal, companyId);
      return { filename: "trial-balance", headers: ["Code", "Account", "Type", "Debit", "Credit"], rows: tb.rows.map((r) => [str(r.code), str(r.name), str(r.type), num(r.debit), num(r.credit)]) };
    },
  },
  "ar-aging": {
    permission: "ar.view", audit: true,
    run: async (principal, params) => {
      const { arAging } = await import("@/domain/accounting/ar");
      const companyId = await companyParam(principal, params);
      const ag = await arAging(principal, companyId);
      return { filename: "ar-aging", headers: ["Customer", "Current", "1-30", "31-60", "61-90", "90+", "Total"], rows: ag.rows.map((r) => [str(r.name), num(r.current), num(r.d30), num(r.d60), num(r.d90), num(r.older), num(r.total)]) };
    },
  },
  "ap-aging": {
    permission: "ap.view", audit: true,
    run: async (principal, params) => {
      const { apAging } = await import("@/domain/accounting/ap");
      const companyId = await companyParam(principal, params);
      const ag = await apAging(principal, companyId);
      return { filename: "ap-aging", headers: ["Supplier", "Current", "1-30", "31-60", "61-90", "90+", "Total"], rows: ag.rows.map((r) => [str(r.name), num(r.current), num(r.d30), num(r.d60), num(r.d90), num(r.older), num(r.total)]) };
    },
  },
};

/** Run an export, enforcing the exporter's permission and auditing sensitive ones. */
export async function runExport(ctx: ActorContext, resource: string, params: URLSearchParams): Promise<{ csv: string; filename: string }> {
  const exp = EXPORTERS[resource];
  if (!exp) throw new ServiceError("unknown_export", "Unknown export resource.", 404);
  if (!canAnywhere(ctx.principal, exp.permission)) throw new ServiceError("forbidden", "You do not have permission to export this data.", 403);
  const result = await exp.run(ctx.principal, params);
  const csv = toCsv(result.headers, result.rows);
  if (exp.audit) await audit(ctx, { action: "data.exported", entityType: "Export", entityId: resource, summary: `${resource} export — ${result.rows.length} rows` });
  return { csv, filename: `${result.filename}-${new Date().toISOString().slice(0, 10)}.csv` };
}

export function exporterExists(resource: string): boolean { return resource in EXPORTERS; }
