import { z } from "zod";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation";
import { canFinance } from "./common";

/**
 * Suppliers — the AP party master (§Increment D). Company-scoped; financial access
 * gated by `ap.*`. Suppliers with ledger history are deactivated/archived, never
 * hard-deleted. Mirrors the AR customer master.
 */
export const supplierSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: optionalString,
  currency: z.string().length(3).optional(),
  email: optionalString,
  phone: optionalString,
  contact: optionalString,
  taxId: optionalString,
  addressJson: optionalString,
  paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  payableAccountId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  notes: optionalString,
});

export const supplierQuerySchema = z.object({
  q: optionalString,
  active: z.enum(["all", "active", "inactive"]).default("active"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export async function listSuppliers(principal: Principal, companyId: string, raw: unknown = {}) {
  assertCan(principal, "ap.view", { companyId });
  const q = supplierQuerySchema.parse(raw);
  const where = {
    companyId,
    archivedAt: null,
    ...(q.active === "active" ? { isActive: true } : q.active === "inactive" ? { isActive: false } : {}),
    ...(q.q ? { OR: [{ name: { contains: q.q, mode: "insensitive" as const } }, { code: { contains: q.q, mode: "insensitive" as const } }, { email: { contains: q.q, mode: "insensitive" as const } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.supplier.findMany({ where, orderBy: { name: "asc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.supplier.count({ where }),
  ]);
  return { rows, total, page: q.page, pageSize: q.pageSize };
}

export async function getSupplier(principal: Principal, id: string) {
  const s = await prisma.supplier.findUnique({ where: { id } });
  if (!s) return null;
  if (!canFinance(principal, "ap.view", s.companyId ?? "")) throw new ServiceError("forbidden", "Forbidden", 403);
  return s;
}

async function assertPayableAccount(companyId: string, accountId: string | null | undefined) {
  if (!accountId) return;
  const acct = await prisma.account.findUnique({ where: { id: accountId } });
  if (!acct || acct.companyId !== companyId) throw new ServiceError("bad_account", "Payable account must belong to this company.", 422);
}

export async function createSupplier(ctx: ActorContext, companyId: string, raw: unknown) {
  assertCan(ctx.principal, "ap.create", { companyId });
  const input = supplierSchema.parse(raw);
  await assertPayableAccount(companyId, input.payableAccountId);
  const s = await prisma.supplier.create({
    data: {
      companyId, name: input.name, code: input.code ?? null, currency: input.currency?.toUpperCase() ?? null,
      email: input.email ?? null, phone: input.phone ?? null, contact: input.contact ?? null, taxId: input.taxId ?? null,
      addressJson: input.addressJson ?? null, paymentTermsDays: input.paymentTermsDays ?? null,
      payableAccountId: input.payableAccountId ?? null, brandId: input.brandId ?? null, countryId: input.countryId ?? null,
      notes: input.notes ?? null, createdById: ctx.principal.userId,
    },
  });
  await audit(ctx, { action: "supplier.created", entityType: "Supplier", entityId: s.id, summary: input.name, companyId });
  return s;
}

export async function updateSupplier(ctx: ActorContext, id: string, raw: unknown) {
  const s = await prisma.supplier.findUnique({ where: { id } });
  if (!s || s.archivedAt) throw new ServiceError("not_found", "Supplier not found", 404);
  assertCan(ctx.principal, "ap.create", { companyId: s.companyId ?? "" });
  const input = supplierSchema.partial().parse(raw);
  await assertPayableAccount(s.companyId ?? "", input.payableAccountId);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "code", "email", "phone", "contact", "taxId", "addressJson", "notes", "brandId", "countryId", "payableAccountId"] as const) if (input[k] !== undefined) data[k] = input[k] ?? null;
  if (input.currency !== undefined) data.currency = input.currency?.toUpperCase() ?? null;
  if (input.paymentTermsDays !== undefined) data.paymentTermsDays = input.paymentTermsDays ?? null;
  const updated = await prisma.supplier.update({ where: { id }, data });
  await audit(ctx, { action: "supplier.updated", entityType: "Supplier", entityId: id, summary: updated.name, companyId: s.companyId });
  return updated;
}

export async function setSupplierActive(ctx: ActorContext, id: string, isActive: boolean) {
  const s = await prisma.supplier.findUnique({ where: { id } });
  if (!s || s.archivedAt) throw new ServiceError("not_found", "Supplier not found", 404);
  assertCan(ctx.principal, "ap.create", { companyId: s.companyId ?? "" });
  const updated = await prisma.supplier.update({ where: { id }, data: { isActive } });
  await audit(ctx, { action: isActive ? "supplier.activated" : "supplier.deactivated", entityType: "Supplier", entityId: id, summary: s.name, companyId: s.companyId });
  return updated;
}

export async function archiveSupplier(ctx: ActorContext, id: string) {
  const s = await prisma.supplier.findUnique({ where: { id } });
  if (!s || s.archivedAt) throw new ServiceError("not_found", "Supplier not found", 404);
  assertCan(ctx.principal, "ap.manage", { companyId: s.companyId ?? "" });
  const open = await prisma.supplierBill.count({ where: { supplierId: id, status: { in: ["open", "partially_paid"] } } });
  if (open > 0) throw new ServiceError("has_open", "Supplier has open bills and cannot be archived.", 422);
  const updated = await prisma.supplier.update({ where: { id }, data: { archivedAt: new Date(), isActive: false } });
  await audit(ctx, { action: "supplier.archived", entityType: "Supplier", entityId: id, summary: s.name, companyId: s.companyId });
  return updated;
}
