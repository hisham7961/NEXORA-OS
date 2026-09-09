import { z } from "zod";
import type { RegistrationCase } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, notify, type ActorContext } from "@/domain/mutation";
import { optionalString, optionalDate } from "@/lib/validation";
import { humanize } from "@/lib/status";

/**
 * Global registration engine (§14). A RegistrationCase carries
 * companyId/brandId/countryId, so its permission-derived scope filter uses
 * DIMS_CBC — every list and single-record read is fenced to the caller's scope
 * server-side (§3, §69).
 */
export const registrationQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  brandId: z.string().optional(),
  countryId: z.string().optional(),
  /** "blocked" = any stage waiting on the group (docs, requirements, payment, samples, rejection). */
  filter: z.string().optional(),
});
export type RegistrationQuery = z.infer<typeof registrationQuerySchema>;

/** Workflow stages where the case is stalled and needs the group to act (§14). */
export const BLOCKED_STATUSES = [
  "documents_missing",
  "additional_requirements",
  "payment_required",
  "samples_requested",
  "rejected",
] as const;

export async function listRegistrations(
  principal: Principal,
  query: RegistrationQuery,
): Promise<{ rows: RegistrationCase[]; total: number }> {
  const statusFilter = query.status
    ? { status: query.status }
    : query.filter === "blocked"
      ? { status: { in: [...BLOCKED_STATUSES] } }
      : {};

  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "registrations.view", DIMS_CBC, {
      ...statusFilter,
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.countryId ? { countryId: query.countryId } : {}),
      ...(query.q ? { OR: [{ registrationNumber: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };

  const [rows, total] = await Promise.all([
    prisma.registrationCase.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.registrationCase.count({ where }),
  ]);

  return { rows, total };
}

/**
 * Full case context (§14): the case, its chronological event timeline and the
 * required-documents checklist. Fail-closed on scope so a brand/country-scoped
 * user cannot open a case outside their reach (§69).
 */
export async function getRegistration(principal: Principal, id: string) {
  const registration = await prisma.registrationCase.findUnique({ where: { id } });
  if (!registration) return null;
  assertRecordInScope(
    principal,
    "registrations.view",
    { companyId: registration.companyId, brandId: registration.brandId, countryId: registration.countryId },
    DIMS_CBC,
  );

  const [events, docReqs] = await Promise.all([
    prisma.registrationEvent.findMany({ where: { caseId: id }, orderBy: { createdAt: "desc" } }),
    prisma.registrationDocReq.findMany({ where: { caseId: id }, orderBy: { createdAt: "asc" } }),
  ]);

  return { registration, events, docReqs };
}

/**
 * Authority id -> display name. RegulatoryAuthority is not a global lookup, so
 * the service resolves the small set in bulk for name rendering (avoids N+1).
 */
export async function getAuthorityNames(): Promise<Map<string, string>> {
  const authorities = await prisma.regulatoryAuthority.findMany({ select: { id: true, name: true } });
  return new Map(authorities.map((a) => [a.id, a.name]));
}

// ---------------------------------------------------------------------------
// WRITE PATHS (§14, Phase 2 Part R) — stage transitions write a chronological
// RegistrationEvent every time; requirements + authority responses are tracked.
// ---------------------------------------------------------------------------

export const REGISTRATION_STAGES = [
  "preparation", "documents_missing", "ready_submission", "submitted", "authority_review",
  "additional_requirements", "samples_requested", "payment_required", "approved", "rejected",
  "registered", "renewal_required", "expired",
] as const;

export const registrationInputSchema = z.object({
  countryId: z.string().min(1),
  productId: optionalString,
  brandId: optionalString,
  companyId: optionalString,
  authorityId: optionalString,
  registrationTypeId: optionalString,
  registrationNumber: optionalString,
  assignedToId: optionalString,
  agentName: optionalString,
  submissionDate: optionalDate,
  expectedCompletion: optionalDate,
  notes: optionalString,
});

function regScope(r: { companyId: string | null; brandId: string | null; countryId: string | null }) {
  return { companyId: r.companyId, brandId: r.brandId, countryId: r.countryId };
}

async function loadEditableRegistration(ctx: ActorContext, id: string) {
  const r = await prisma.registrationCase.findUnique({ where: { id } });
  if (!r || r.archivedAt) throw new ServiceError("not_found", "Registration case not found", 404);
  assertRecordInScope(ctx.principal, "registrations.edit", regScope(r), DIMS_CBC);
  return r;
}

async function addEvent(caseId: string, actorId: string, type: string, title: string, description?: string) {
  await prisma.registrationEvent.create({ data: { caseId, actorId, type, title, description: description ?? null } });
}

export async function createRegistrationCase(ctx: ActorContext, raw: unknown): Promise<RegistrationCase> {
  const input = registrationInputSchema.parse(raw);
  const scope = { companyId: input.companyId ?? null, brandId: input.brandId ?? null, countryId: input.countryId };
  assertCan(ctx.principal, "registrations.create", scope);
  const rc = await prisma.$transaction(async (tx) => {
    const r = await tx.registrationCase.create({
      data: {
        ...scope,
        productId: input.productId ?? null, authorityId: input.authorityId ?? null, registrationTypeId: input.registrationTypeId ?? null,
        registrationNumber: input.registrationNumber ?? null, assignedToId: input.assignedToId ?? null, agentName: input.agentName ?? null,
        submissionDate: input.submissionDate ?? null, expectedCompletion: input.expectedCompletion ?? null, notes: input.notes ?? null,
        status: "preparation", createdById: ctx.principal.userId,
      },
    });
    await tx.registrationEvent.create({ data: { caseId: r.id, actorId: ctx.principal.userId, type: "created", title: "Case opened" } });
    return r;
  });
  await audit(ctx, { action: "registration.created", entityType: "RegistrationCase", entityId: rc.id, summary: "Case opened", brandId: rc.brandId, companyId: rc.companyId });
  await notify([input.assignedToId], { type: "registration.assigned", title: "A registration case was assigned to you", entityType: "RegistrationCase", entityId: rc.id }, ctx.principal.userId);
  return rc;
}

/** Change the workflow stage — always records a RegistrationEvent (§14). */
export async function changeStage(ctx: ActorContext, id: string, status: string, comment?: string): Promise<RegistrationCase> {
  if (!(REGISTRATION_STAGES as readonly string[]).includes(status)) throw new ServiceError("invalid_stage", "Unknown registration stage", 400);
  const existing = await loadEditableRegistration(ctx, id);
  const data: Record<string, unknown> = { status };
  if ((status === "approved" || status === "registered") && !existing.approvalDate) data.approvalDate = new Date();
  if (status === "submitted" && !existing.submissionDate) data.submissionDate = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.registrationCase.update({ where: { id }, data });
    await tx.registrationEvent.create({ data: { caseId: id, actorId: ctx.principal.userId, type: "status", title: `Moved to ${humanize(status)}`, description: comment ?? null } });
    return r;
  });
  await audit(ctx, { action: "registration.stage_changed", entityType: "RegistrationCase", entityId: id, summary: `${existing.status} → ${status}`, brandId: existing.brandId, companyId: existing.companyId, oldValues: { status: existing.status }, newValues: { status } });
  await notify([existing.assignedToId], { type: "registration.stage", title: `Registration moved to ${humanize(status)}`, entityType: "RegistrationCase", entityId: id }, ctx.principal.userId);
  return updated;
}

export async function updateRegistration(ctx: ActorContext, id: string, raw: unknown): Promise<RegistrationCase> {
  const existing = await loadEditableRegistration(ctx, id);
  const schema = registrationInputSchema.partial().extend({ expiryDate: optionalDate, renewalDate: optionalDate, approvalDate: optionalDate });
  const input = schema.parse(raw);
  const data: Record<string, unknown> = {};
  for (const k of ["registrationNumber", "assignedToId", "agentName", "notes", "authorityId", "registrationTypeId"] as const) {
    if (input[k] !== undefined) data[k] = input[k];
  }
  for (const k of ["submissionDate", "expiryDate", "renewalDate", "approvalDate", "expectedCompletion"] as const) {
    if (input[k] !== undefined) data[k] = input[k];
  }
  const updated = await prisma.registrationCase.update({ where: { id }, data });
  await audit(ctx, { action: "registration.updated", entityType: "RegistrationCase", entityId: id, summary: "Fields updated", brandId: existing.brandId, companyId: existing.companyId, newValues: data });
  return updated;
}

export async function addRequirement(ctx: ActorContext, id: string, name: string, documentTypeId?: string): Promise<void> {
  const existing = await loadEditableRegistration(ctx, id);
  await prisma.registrationDocReq.create({ data: { caseId: id, name: name.trim(), documentTypeId: documentTypeId ?? null, status: "required" } });
  await addEvent(id, ctx.principal.userId, "requirement", `Requirement added: ${name.trim()}`);
  await audit(ctx, { action: "registration.requirement_added", entityType: "RegistrationCase", entityId: id, summary: name.trim(), brandId: existing.brandId, companyId: existing.companyId });
}

export async function setRequirementStatus(ctx: ActorContext, id: string, reqId: string, status: string): Promise<void> {
  const existing = await loadEditableRegistration(ctx, id);
  const valid = ["required", "received", "submitted", "missing"];
  if (!valid.includes(status)) throw new ServiceError("invalid", "Invalid requirement status", 400);
  const req = await prisma.registrationDocReq.findUnique({ where: { id: reqId } });
  if (!req || req.caseId !== id) throw new ServiceError("not_found", "Requirement not found", 404);
  await prisma.registrationDocReq.update({ where: { id: reqId }, data: { status } });
  await addEvent(id, ctx.principal.userId, "document", `${req.name}: ${status}`);
  await audit(ctx, { action: "registration.requirement_status", entityType: "RegistrationCase", entityId: id, summary: `${req.name} → ${status}`, brandId: existing.brandId, companyId: existing.companyId });
}

export async function recordAuthorityResponse(ctx: ActorContext, id: string, text: string): Promise<void> {
  const existing = await loadEditableRegistration(ctx, id);
  if (!text.trim()) throw new ServiceError("empty", "Response text is required", 422);
  await addEvent(id, ctx.principal.userId, "authority", "Authority response", text.trim());
  await audit(ctx, { action: "registration.authority_response", entityType: "RegistrationCase", entityId: id, summary: text.trim().slice(0, 80), brandId: existing.brandId, companyId: existing.companyId });
}
