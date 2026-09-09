import { z } from "zod";
import type { CustomerCase } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, notify, type ActorContext } from "@/domain/mutation";
import { requiredString, optionalString } from "@/lib/validation";

/** Customer cases (§17). */
export const caseQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  type: z.string().optional(),
  brandId: z.string().optional(),
});
export type CaseQuery = z.infer<typeof caseQuerySchema>;

export async function listCases(principal: Principal, query: CaseQuery): Promise<{ rows: CustomerCase[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "cases.view", DIMS_CBC, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ description: { contains: query.q, mode: "insensitive" } }, { customerRef: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.customerCase.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.customerCase.count({ where }),
  ]);
  return { rows, total };
}

export async function getCase(principal: Principal, id: string) {
  const c = await prisma.customerCase.findUnique({ where: { id }, include: { notes: { orderBy: { createdAt: "desc" } } } });
  if (!c) return null;
  assertRecordInScope(principal, "cases.view", { companyId: c.companyId, brandId: c.brandId, countryId: c.countryId }, DIMS_CBC);
  return c;
}

// ---------------------------------------------------------------------------
// WRITE PATHS (§17, Phase 2 Part Q) — create/assign/status/notes/escalate/resolve.
// ---------------------------------------------------------------------------

const CASE_STATUSES = ["new", "assigned", "waiting", "in_progress", "escalated", "resolved", "closed"] as const;
const CASE_TYPES = ["product_question", "complaint", "return", "refund", "damaged", "delivery", "wrong_item", "ecommerce", "ad_issue", "medical_info", "other"] as const;

export const caseInputSchema = z.object({
  type: z.enum(CASE_TYPES),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  companyId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  storeId: optionalString,
  productId: optionalString,
  orderRef: optionalString,
  customerRef: optionalString,
  description: optionalString,
  assignedToId: optionalString,
});

function caseScope(c: { companyId: string | null; brandId: string | null; countryId: string | null }) {
  return { companyId: c.companyId, brandId: c.brandId, countryId: c.countryId };
}

export async function createCase(ctx: ActorContext, raw: unknown): Promise<CustomerCase> {
  const input = caseInputSchema.parse(raw);
  const scope = { companyId: input.companyId ?? null, brandId: input.brandId ?? null, countryId: input.countryId ?? null };
  assertCan(ctx.principal, "cases.create", scope);
  const c = await prisma.customerCase.create({
    data: {
      type: input.type, priority: input.priority, ...scope,
      storeId: input.storeId ?? null, productId: input.productId ?? null,
      orderRef: input.orderRef ?? null, customerRef: input.customerRef ?? null,
      description: input.description ?? null, assignedToId: input.assignedToId ?? null,
      status: input.assignedToId ? "assigned" : "new", createdById: ctx.principal.userId,
    },
  });
  await audit(ctx, { action: "case.created", entityType: "CustomerCase", entityId: c.id, summary: input.type, brandId: c.brandId, companyId: c.companyId });
  await notify([input.assignedToId], { type: "case.assigned", title: "A case was assigned to you", body: input.description ?? input.type, entityType: "CustomerCase", entityId: c.id }, ctx.principal.userId);
  return c;
}

async function loadEditableCase(ctx: ActorContext, id: string) {
  const c = await prisma.customerCase.findUnique({ where: { id } });
  if (!c || c.archivedAt) throw new ServiceError("not_found", "Case not found", 404);
  assertRecordInScope(ctx.principal, "cases.edit", caseScope(c), DIMS_CBC);
  return c;
}

export const caseUpdateSchema = caseInputSchema.partial().extend({ status: z.enum(CASE_STATUSES).optional(), resolution: optionalString });

export async function updateCase(ctx: ActorContext, id: string, raw: unknown): Promise<CustomerCase> {
  const existing = await loadEditableCase(ctx, id);
  const input = caseUpdateSchema.parse(raw);
  const data: Record<string, unknown> = {};
  for (const k of ["type", "priority", "status", "assignedToId", "storeId", "productId", "orderRef", "customerRef", "description", "resolution"] as const) {
    if (input[k] !== undefined) data[k] = input[k];
  }
  const updated = await prisma.customerCase.update({ where: { id }, data });
  await audit(ctx, { action: "case.updated", entityType: "CustomerCase", entityId: id, summary: input.status ? `→ ${input.status}` : "updated", brandId: existing.brandId, companyId: existing.companyId, newValues: data });
  if (input.assignedToId && input.assignedToId !== existing.assignedToId) {
    await notify([input.assignedToId], { type: "case.assigned", title: "A case was assigned to you", body: existing.description ?? existing.type, entityType: "CustomerCase", entityId: id }, ctx.principal.userId);
  }
  return updated;
}

export async function setCaseStatus(ctx: ActorContext, id: string, status: string): Promise<CustomerCase> {
  if (!(CASE_STATUSES as readonly string[]).includes(status)) throw new ServiceError("invalid_status", "Unknown case status", 400);
  const existing = await loadEditableCase(ctx, id);
  const updated = await prisma.customerCase.update({ where: { id }, data: { status } });
  await audit(ctx, { action: "case.status_changed", entityType: "CustomerCase", entityId: id, summary: `${existing.status} → ${status}`, brandId: existing.brandId, companyId: existing.companyId, oldValues: { status: existing.status }, newValues: { status } });
  return updated;
}

export async function addCaseNote(ctx: ActorContext, id: string, body: string, isInternal: boolean): Promise<void> {
  const existing = await loadEditableCase(ctx, id);
  if (!body.trim()) throw new ServiceError("empty", "Note cannot be empty", 422);
  await prisma.customerCaseNote.create({ data: { caseId: id, authorId: ctx.principal.userId, body: body.trim(), isInternal } });
  await audit(ctx, { action: "case.note_added", entityType: "CustomerCase", entityId: id, summary: isInternal ? "Internal note" : "Reply", brandId: existing.brandId, companyId: existing.companyId });
}
