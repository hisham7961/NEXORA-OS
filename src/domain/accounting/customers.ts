import { z } from "zod";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation";
import { canFinance } from "./common";

/**
 * Customers — the AR party master (§Increment C). Company-scoped (a customer is
 * billed by one legal company); financial access gated by `ar.*`. Customers with
 * ledger history are deactivated/archived, never hard-deleted.
 */

export const customerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: optionalString,
  currency: z.string().length(3).optional(),
  email: optionalString,
  phone: optionalString,
  contact: optionalString,
  taxId: optionalString,
  addressJson: optionalString,
  paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  creditLimit: z.coerce.number().min(0).optional(),
  receivableAccountId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  notes: optionalString,
});

export const customerQuerySchema = z.object({
  q: optionalString,
  active: z.enum(["all", "active", "inactive"]).default("active"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export async function listCustomers(principal: Principal, companyId: string, raw: unknown = {}) {
  assertCan(principal, "ar.view", { companyId });
  const q = customerQuerySchema.parse(raw);
  const where = {
    companyId,
    archivedAt: null,
    ...(q.active === "active" ? { isActive: true } : q.active === "inactive" ? { isActive: false } : {}),
    ...(q.q ? { OR: [{ name: { contains: q.q, mode: "insensitive" as const } }, { code: { contains: q.q, mode: "insensitive" as const } }, { email: { contains: q.q, mode: "insensitive" as const } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { name: "asc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.customer.count({ where }),
  ]);
  return { rows, total, page: q.page, pageSize: q.pageSize };
}

export async function getCustomer(principal: Principal, id: string) {
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c) return null;
  if (!canFinance(principal, "ar.view", c.companyId ?? "")) throw new ServiceError("forbidden", "Forbidden", 403);
  return c;
}

async function assertReceivableAccount(companyId: string, accountId: string | null | undefined) {
  if (!accountId) return;
  const acct = await prisma.account.findUnique({ where: { id: accountId } });
  if (!acct || acct.companyId !== companyId) throw new ServiceError("bad_account", "Receivable account must belong to this company.", 422);
}

export async function createCustomer(ctx: ActorContext, companyId: string, raw: unknown) {
  assertCan(ctx.principal, "ar.create", { companyId });
  const input = customerSchema.parse(raw);
  await assertReceivableAccount(companyId, input.receivableAccountId);
  const c = await prisma.customer.create({
    data: {
      companyId, name: input.name, code: input.code ?? null, currency: input.currency?.toUpperCase() ?? null,
      email: input.email ?? null, phone: input.phone ?? null, contact: input.contact ?? null, taxId: input.taxId ?? null,
      addressJson: input.addressJson ?? null, paymentTermsDays: input.paymentTermsDays ?? null,
      creditLimit: input.creditLimit ?? null, receivableAccountId: input.receivableAccountId ?? null,
      brandId: input.brandId ?? null, countryId: input.countryId ?? null, notes: input.notes ?? null,
      createdById: ctx.principal.userId,
    },
  });
  await audit(ctx, { action: "customer.created", entityType: "Customer", entityId: c.id, summary: input.name, companyId });
  return c;
}

export async function updateCustomer(ctx: ActorContext, id: string, raw: unknown) {
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c || c.archivedAt) throw new ServiceError("not_found", "Customer not found", 404);
  assertCan(ctx.principal, "ar.create", { companyId: c.companyId ?? "" });
  const input = customerSchema.partial().parse(raw);
  await assertReceivableAccount(c.companyId ?? "", input.receivableAccountId);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "code", "email", "phone", "contact", "taxId", "addressJson", "notes", "brandId", "countryId", "receivableAccountId"] as const) if (input[k] !== undefined) data[k] = input[k] ?? null;
  if (input.currency !== undefined) data.currency = input.currency?.toUpperCase() ?? null;
  if (input.paymentTermsDays !== undefined) data.paymentTermsDays = input.paymentTermsDays ?? null;
  if (input.creditLimit !== undefined) data.creditLimit = input.creditLimit ?? null;
  const updated = await prisma.customer.update({ where: { id }, data });
  await audit(ctx, { action: "customer.updated", entityType: "Customer", entityId: id, summary: updated.name, companyId: c.companyId });
  return updated;
}

export async function setCustomerActive(ctx: ActorContext, id: string, isActive: boolean) {
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c || c.archivedAt) throw new ServiceError("not_found", "Customer not found", 404);
  assertCan(ctx.principal, "ar.create", { companyId: c.companyId ?? "" });
  const updated = await prisma.customer.update({ where: { id }, data: { isActive } });
  await audit(ctx, { action: isActive ? "customer.activated" : "customer.deactivated", entityType: "Customer", entityId: id, summary: c.name, companyId: c.companyId });
  return updated;
}

export async function archiveCustomer(ctx: ActorContext, id: string) {
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c || c.archivedAt) throw new ServiceError("not_found", "Customer not found", 404);
  assertCan(ctx.principal, "ar.manage", { companyId: c.companyId ?? "" });
  const open = await prisma.salesInvoice.count({ where: { customerId: id, status: { in: ["issued", "partially_paid"] } } });
  if (open > 0) throw new ServiceError("has_open", "Customer has open invoices and cannot be archived.", 422);
  const updated = await prisma.customer.update({ where: { id }, data: { archivedAt: new Date(), isActive: false } });
  await audit(ctx, { action: "customer.archived", entityType: "Customer", entityId: id, summary: c.name, companyId: c.companyId });
  return updated;
}
