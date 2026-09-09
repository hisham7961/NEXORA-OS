import { z } from "zod";
import type { DesignRequest, DesignVersion } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, notify, type ActorContext } from "@/domain/mutation";
import { optionalString, optionalDate } from "@/lib/validation";
import { storeUploadedFile } from "@/domain/files";

/** Creative / design requests (§12). */
export const designQuerySchema = listQuerySchema.extend({ status: z.string().optional(), brandId: z.string().optional() });
export type DesignQuery = z.infer<typeof designQuerySchema>;

export async function listDesign(principal: Principal, query: DesignQuery): Promise<{ rows: DesignRequest[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "design.view", DIMS_CBC, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ assetType: { contains: query.q, mode: "insensitive" } }, { copy: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.designRequest.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.designRequest.count({ where }),
  ]);
  return { rows, total };
}

export async function getDesign(principal: Principal, id: string) {
  const req = await prisma.designRequest.findUnique({ where: { id }, include: { versions: { orderBy: { version: "desc" } } } });
  if (!req) return null;
  assertRecordInScope(principal, "design.view", { companyId: req.companyId, brandId: req.brandId, countryId: req.countryId }, DIMS_CBC);
  return req;
}

// ---------------------------------------------------------------------------
// WRITE PATH (§12, Phase 2 Part O) — creative request lifecycle + versioned
// review. History is preserved: an approved creative is never overwritten;
// approving a newer version supersedes the previous approval.
// ---------------------------------------------------------------------------

const DESIGN_STATUSES = [
  "requested", "brief_review", "assigned", "designing", "internal_review",
  "revision", "waiting_approval", "approved", "delivered", "published", "archived",
] as const;
const ASSET_TYPES = ["post", "story", "reel", "banner", "packaging", "video", "print", "email", "web", "other"] as const;

/** Allowed forward/loop transitions for the creative lifecycle. */
const DESIGN_NEXT: Record<string, string[]> = {
  requested: ["brief_review", "assigned"],
  brief_review: ["assigned", "requested"],
  assigned: ["designing"],
  designing: ["internal_review"],
  internal_review: ["revision", "waiting_approval"],
  revision: ["designing"],
  waiting_approval: ["approved", "revision"],
  approved: ["delivered", "revision"],
  delivered: ["published", "approved"],
  published: [],
  archived: [],
};

export const designInputSchema = z.object({
  assetType: z.enum(ASSET_TYPES),
  companyId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  productId: optionalString,
  campaignId: optionalString,
  dimensions: optionalString,
  platform: optionalString,
  copy: optionalString,
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  deadline: optionalDate,
  designerId: optionalString,
  reviewerId: optionalString,
});

function designScope(r: { companyId: string | null; brandId: string | null; countryId: string | null }) {
  return { companyId: r.companyId, brandId: r.brandId, countryId: r.countryId };
}

export async function createDesignRequest(ctx: ActorContext, raw: unknown): Promise<DesignRequest> {
  const input = designInputSchema.parse(raw);
  const scope = { companyId: input.companyId ?? null, brandId: input.brandId ?? null, countryId: input.countryId ?? null };
  assertCan(ctx.principal, "design.create", scope);
  const req = await prisma.designRequest.create({
    data: {
      assetType: input.assetType, ...scope, productId: input.productId ?? null,
      campaignId: input.campaignId ?? null, dimensions: input.dimensions ?? null,
      platform: input.platform ?? null, copy: input.copy ?? null, priority: input.priority,
      deadline: input.deadline ?? null, designerId: input.designerId ?? null,
      reviewerId: input.reviewerId ?? null, requesterId: ctx.principal.userId,
      status: input.designerId ? "assigned" : "requested",
    },
  });
  await audit(ctx, { action: "design.created", entityType: "DesignRequest", entityId: req.id, summary: input.assetType, brandId: req.brandId, companyId: req.companyId });
  await notify([input.designerId, input.reviewerId], { type: "design.assigned", title: "A design request needs you", body: input.assetType, entityType: "DesignRequest", entityId: req.id }, ctx.principal.userId);
  return req;
}

async function loadEditableDesign(ctx: ActorContext, id: string): Promise<DesignRequest> {
  const req = await prisma.designRequest.findUnique({ where: { id } });
  if (!req || req.archivedAt) throw new ServiceError("not_found", "Design request not found", 404);
  assertRecordInScope(ctx.principal, "design.edit", designScope(req), DIMS_CBC);
  return req;
}

export const designUpdateSchema = designInputSchema.partial();

export async function updateDesignRequest(ctx: ActorContext, id: string, raw: unknown): Promise<DesignRequest> {
  const existing = await loadEditableDesign(ctx, id);
  const input = designUpdateSchema.parse(raw);
  const data: Record<string, unknown> = {};
  for (const k of ["assetType", "productId", "campaignId", "dimensions", "platform", "copy", "priority", "deadline", "designerId", "reviewerId"] as const) {
    if (input[k] !== undefined) data[k] = input[k];
  }
  const updated = await prisma.designRequest.update({ where: { id }, data });
  await audit(ctx, { action: "design.updated", entityType: "DesignRequest", entityId: id, summary: "updated", brandId: existing.brandId, companyId: existing.companyId, newValues: data });
  if (input.designerId && input.designerId !== existing.designerId) {
    await notify([input.designerId], { type: "design.assigned", title: "A design request was assigned to you", body: existing.assetType, entityType: "DesignRequest", entityId: id }, ctx.principal.userId);
  }
  return updated;
}

export async function setDesignStatus(ctx: ActorContext, id: string, status: string): Promise<DesignRequest> {
  if (!(DESIGN_STATUSES as readonly string[]).includes(status)) throw new ServiceError("invalid_status", "Unknown design status", 400);
  const existing = await loadEditableDesign(ctx, id);
  const allowed = DESIGN_NEXT[existing.status] ?? [];
  if (existing.status !== status && !allowed.includes(status)) {
    throw new ServiceError("invalid_transition", `Cannot move from ${existing.status} to ${status}`, 422);
  }
  const updated = await prisma.designRequest.update({ where: { id }, data: { status } });
  await audit(ctx, { action: "design.status_changed", entityType: "DesignRequest", entityId: id, summary: `${existing.status} → ${status}`, brandId: existing.brandId, companyId: existing.companyId, oldValues: { status: existing.status }, newValues: { status } });
  return updated;
}

export const designVersionSchema = z.object({
  fileId: optionalString,
  note: optionalString,
});

/**
 * Upload a new creative version. The version number is assigned server-side
 * (max + 1) so history is append-only and never collides; adding one moves the
 * request into internal review. Blocked once delivered/published/archived.
 */
export async function addDesignVersion(ctx: ActorContext, requestId: string, raw: unknown): Promise<DesignVersion> {
  const existing = await loadEditableDesign(ctx, requestId);
  if (["delivered", "published", "archived"].includes(existing.status)) {
    throw new ServiceError("closed", "This request is closed to new versions", 422);
  }
  const input = designVersionSchema.parse(raw);
  const version = await prisma.$transaction(async (tx) => {
    const last = await tx.designVersion.findFirst({ where: { designRequestId: requestId }, orderBy: { version: "desc" }, select: { version: true } });
    const next = (last?.version ?? 0) + 1;
    const v = await tx.designVersion.create({
      data: { designRequestId: requestId, version: next, fileId: input.fileId ?? null, note: input.note ?? null, uploadedById: ctx.principal.userId },
    });
    // Uploading a new version puts the request back into review (unless already there).
    if (!["internal_review", "waiting_approval"].includes(existing.status)) {
      await tx.designRequest.update({ where: { id: requestId }, data: { status: "internal_review" } });
    }
    return v;
  });
  await auditVersionAdded(ctx, existing, version.version, requestId);
  return version;
}

/**
 * Add a creative version backed by a real uploaded file (§6). The file goes
 * through the File Platform (scoped to the request, category "creative",
 * attached to the DesignRequest), then its id is recorded on the append-only,
 * server-numbered DesignVersion — so designers actually upload artwork and its
 * history is preserved with everything else the platform gives files.
 */
export async function addDesignVersionWithFile(
  ctx: ActorContext,
  requestId: string,
  upload: { filename: string; body: Buffer; mimeType: string; note?: string | null },
): Promise<DesignVersion> {
  const existing = await loadEditableDesign(ctx, requestId);
  if (["delivered", "published", "archived"].includes(existing.status)) {
    throw new ServiceError("closed", "This request is closed to new versions", 422);
  }
  // The caller is authorized via design.edit on the request, so the artwork
  // upload uses the trusted internal path (a designer need not hold a separate
  // global files.create grant).
  const file = await storeUploadedFile(ctx, {
    filename: upload.filename, body: upload.body, mimeType: upload.mimeType,
    category: "creative", companyId: existing.companyId, brandId: existing.brandId, countryId: existing.countryId,
    relatedType: "DesignRequest", relatedId: requestId,
  });
  await prisma.fileAttachment.create({ data: { fileId: file.id, entityType: "DesignRequest", entityId: requestId, createdById: ctx.principal.userId } });

  const version = await prisma.$transaction(async (tx) => {
    const last = await tx.designVersion.findFirst({ where: { designRequestId: requestId }, orderBy: { version: "desc" }, select: { version: true } });
    const next = (last?.version ?? 0) + 1;
    const v = await tx.designVersion.create({
      data: { designRequestId: requestId, version: next, fileId: file.id, note: upload.note ?? null, uploadedById: ctx.principal.userId },
    });
    if (!["internal_review", "waiting_approval"].includes(existing.status)) {
      await tx.designRequest.update({ where: { id: requestId }, data: { status: "internal_review" } });
    }
    return v;
  });
  await auditVersionAdded(ctx, existing, version.version, requestId);
  return version;
}

async function auditVersionAdded(ctx: ActorContext, existing: DesignRequest, version: number, requestId: string) {
  await audit(ctx, { action: "design.version_added", entityType: "DesignRequest", entityId: requestId, summary: `v${version} uploaded`, brandId: existing.brandId, companyId: existing.companyId });
  await notify([existing.reviewerId], { type: "design.review", title: "A design version needs review", body: `v${version} · ${existing.assetType}`, entityType: "DesignRequest", entityId: requestId }, ctx.principal.userId);
  return version;
}

/**
 * Approve a specific version (§12). Requires design.approve in scope. The
 * approval is exclusive — a newly approved version supersedes any previous
 * approval, but every version row is preserved. Moves the request to approved.
 */
export async function approveDesignVersion(ctx: ActorContext, requestId: string, versionId: string): Promise<void> {
  const existing = await prisma.designRequest.findUnique({ where: { id: requestId } });
  if (!existing || existing.archivedAt) throw new ServiceError("not_found", "Design request not found", 404);
  assertCan(ctx.principal, "design.approve", designScope(existing));
  const version = await prisma.designVersion.findUnique({ where: { id: versionId } });
  if (!version || version.designRequestId !== requestId) throw new ServiceError("not_found", "Version not found", 404);

  await prisma.$transaction([
    // Supersede any prior approval; preserve rows.
    prisma.designVersion.updateMany({ where: { designRequestId: requestId, isApproved: true }, data: { isApproved: false } }),
    prisma.designVersion.update({ where: { id: versionId }, data: { isApproved: true, isRejected: false } }),
    prisma.designRequest.update({ where: { id: requestId }, data: { status: "approved" } }),
  ]);
  await audit(ctx, { action: "design.version_approved", entityType: "DesignRequest", entityId: requestId, summary: `v${version.version} approved`, brandId: existing.brandId, companyId: existing.companyId });
  await notify([existing.designerId, existing.requesterId], { type: "design.approved", title: "A design version was approved", body: `v${version.version} · ${existing.assetType}`, entityType: "DesignRequest", entityId: requestId }, ctx.principal.userId);
}

/** Reject a version — sends the request back to revision. */
export async function rejectDesignVersion(ctx: ActorContext, requestId: string, versionId: string, note?: string): Promise<void> {
  const existing = await loadEditableDesign(ctx, requestId);
  const version = await prisma.designVersion.findUnique({ where: { id: versionId } });
  if (!version || version.designRequestId !== requestId) throw new ServiceError("not_found", "Version not found", 404);
  await prisma.$transaction([
    prisma.designVersion.update({ where: { id: versionId }, data: { isRejected: true, isApproved: false, ...(note ? { note } : {}) } }),
    prisma.designRequest.update({ where: { id: requestId }, data: { status: "revision" } }),
  ]);
  await audit(ctx, { action: "design.version_rejected", entityType: "DesignRequest", entityId: requestId, summary: `v${version.version} rejected`, brandId: existing.brandId, companyId: existing.companyId });
  await notify([existing.designerId], { type: "design.revision", title: "A design version needs revision", body: `v${version.version} · ${existing.assetType}`, entityType: "DesignRequest", entityId: requestId }, ctx.principal.userId);
}

export { DESIGN_NEXT };
