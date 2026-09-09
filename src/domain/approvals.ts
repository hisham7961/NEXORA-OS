import { z } from "zod";
import type { ApprovalRequest } from "@prisma/client";
import { prisma } from "@/lib/db";
import { can, ForbiddenError, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere } from "@/domain/scope";
import { ServiceError } from "@/lib/api/handler";
import { audit, notify, type ActorContext } from "@/domain/mutation";
import { requiredString, optionalString } from "@/lib/validation";

/** Approval Center (§24). */
export const approvalQuerySchema = listQuerySchema.extend({ status: z.string().optional(), type: z.string().optional() });
export type ApprovalQuery = z.infer<typeof approvalQuerySchema>;

export async function listApprovals(principal: Principal, query: ApprovalQuery): Promise<{ rows: ApprovalRequest[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "approvals.view", ["companyId", "brandId"], {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.q ? { OR: [{ title: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.approvalRequest.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.approvalRequest.count({ where }),
  ]);
  return { rows, total };
}

/** Items awaiting the current user's decision ("Waiting for me"). */
export async function getMyApprovals(principal: Principal) {
  const steps = await prisma.approvalStep.findMany({
    where: { approverUserId: principal.userId, status: "pending", request: { status: "pending" } },
    include: { request: true },
    orderBy: { id: "desc" },
    take: 50,
  });
  return steps;
}

export async function getApproval(id: string) {
  return prisma.approvalRequest.findUnique({ where: { id }, include: { steps: { orderBy: { order: "asc" } } } });
}

// ---------------------------------------------------------------------------
// APPROVAL ENGINE (§24, Phase 2 Part J) — sequential multi-step approvals with
// an immutable decision history. A later step can never approve before earlier
// steps are complete (all action happens on `currentStep`).
// ---------------------------------------------------------------------------

export const approvalCreateSchema = z.object({
  title: requiredString(200),
  type: z.string().min(1).max(40),
  entityType: optionalString,
  entityId: optionalString,
  companyId: optionalString,
  brandId: optionalString,
  notes: optionalString,
  approverIds: z.array(z.string().min(1)).min(1, "At least one approver is required"),
});

/** Submit a request for approval, creating its sequential steps. */
export async function createApprovalRequest(ctx: ActorContext, raw: unknown): Promise<ApprovalRequest> {
  const input = approvalCreateSchema.parse(raw);
  const request = await prisma.$transaction(async (tx) => {
    const r = await tx.approvalRequest.create({
      data: {
        title: input.title,
        type: input.type,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        companyId: input.companyId ?? null,
        brandId: input.brandId ?? null,
        notes: input.notes ?? null,
        requesterId: ctx.principal.userId,
        status: "pending",
        currentStep: 1,
      },
    });
    await tx.approvalStep.createMany({
      data: input.approverIds.map((approverUserId, i) => ({ requestId: r.id, order: i + 1, approverUserId, status: "pending" })),
    });
    return r;
  });
  await audit(ctx, { action: "approval.submitted", entityType: "ApprovalRequest", entityId: request.id, summary: input.title, brandId: request.brandId, companyId: request.companyId });
  await notify([input.approverIds[0]], { type: "approval.pending", title: "An item needs your approval", body: input.title, entityType: "ApprovalRequest", entityId: request.id }, ctx.principal.userId);
  return request;
}

type Decision = "approved" | "rejected" | "changes";

/** Approve / reject / request-changes the CURRENT step of a pending request. */
export async function decideApproval(ctx: ActorContext, requestId: string, decision: Decision, comment?: string): Promise<ApprovalRequest> {
  const request = await prisma.approvalRequest.findUnique({ where: { id: requestId }, include: { steps: { orderBy: { order: "asc" } } } });
  if (!request || request.archivedAt) throw new ServiceError("not_found", "Approval request not found", 404);
  if (request.status !== "pending") throw new ServiceError("closed", "This request is already resolved.", 409);

  const step = request.steps.find((s) => s.order === request.currentStep);
  if (!step) throw new ServiceError("no_step", "No pending step to act on.", 409);

  const scope = { companyId: request.companyId, brandId: request.brandId };
  const isNamedApprover = !!step.approverUserId && step.approverUserId === ctx.principal.userId;
  const hasApproveRight = can(ctx.principal, "approvals.approve", scope);
  if (!isNamedApprover && !hasApproveRight) throw new ForbiddenError("approvals.approve");

  const isLast = request.currentStep >= request.steps.length;
  const newRequestStatus = decision === "approved" ? (isLast ? "approved" : "pending") : decision;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.approvalStep.update({
      where: { id: step.id },
      data: { status: decision, decidedAt: new Date(), comment: comment ?? null, approverUserId: step.approverUserId ?? ctx.principal.userId },
    });
    return tx.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: newRequestStatus,
        currentStep: decision === "approved" && !isLast ? request.currentStep + 1 : request.currentStep,
      },
    });
  });

  await audit(ctx, {
    action: `approval.${decision}`,
    entityType: "ApprovalRequest",
    entityId: requestId,
    summary: `Step ${step.order}: ${decision}${comment ? ` — ${comment}` : ""}`,
    brandId: request.brandId,
    companyId: request.companyId,
    oldValues: { status: request.status, step: request.currentStep },
    newValues: { status: newRequestStatus, decision },
  });

  // Notify the right people.
  if (decision === "approved" && !isLast) {
    const next = request.steps.find((s) => s.order === request.currentStep + 1);
    await notify([next?.approverUserId], { type: "approval.pending", title: "An item needs your approval", body: request.title, entityType: "ApprovalRequest", entityId: requestId }, ctx.principal.userId);
  } else {
    await notify([request.requesterId], { type: `approval.${decision}`, title: `Your request was ${decision === "changes" ? "returned for changes" : decision}`, body: request.title, entityType: "ApprovalRequest", entityId: requestId }, ctx.principal.userId);
  }
  return updated;
}

/** Requester (or an approvals manager) cancels a pending request. */
export async function cancelApprovalRequest(ctx: ActorContext, requestId: string): Promise<void> {
  const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new ServiceError("not_found", "Approval request not found", 404);
  if (request.status !== "pending") throw new ServiceError("closed", "This request is already resolved.", 409);
  const canManage = can(ctx.principal, "approvals.manage", { companyId: request.companyId, brandId: request.brandId });
  if (request.requesterId !== ctx.principal.userId && !canManage) throw new ForbiddenError("approvals.cancel");
  await prisma.approvalRequest.update({ where: { id: requestId }, data: { status: "cancelled" } });
  await audit(ctx, { action: "approval.cancelled", entityType: "ApprovalRequest", entityId: requestId, summary: request.title, brandId: request.brandId, companyId: request.companyId });
}
