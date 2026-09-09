import { z } from "zod";
import type { ApprovedAnswer, AnswerVersion } from "@prisma/client";
import { prisma } from "@/lib/db";
import { can, canAnywhere, ForbiddenError, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { optionalString } from "@/lib/validation";

/** Approved Answer Library (§18). Scoped by brand (records may be brand-null = global). */
export const answerQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  category: z.string().optional(),
  language: z.string().optional(),
  brandId: z.string().optional(),
});
export type AnswerQuery = z.infer<typeof answerQuerySchema>;

export async function listAnswers(principal: Principal, query: AnswerQuery): Promise<{ rows: ApprovedAnswer[]; total: number }> {
  const ids = answerBrandScope(principal);
  const where: Record<string, unknown> = {
    archivedAt: null,
    // brand-null answers are group-wide and visible to any answers viewer.
    ...(ids === "all" ? {} : { OR: [{ brandId: null }, { brandId: { in: ids } }] }),
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.language ? { language: query.language } : {}),
    ...(query.brandId ? { brandId: query.brandId } : {}),
    ...(query.q ? { question: { contains: query.q, mode: "insensitive" } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.approvedAnswer.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.approvedAnswer.count({ where }),
  ]);
  return { rows, total };
}

// ---------------------------------------------------------------------------
// CONTROLLED ANSWER LIFECYCLE (§13–17). Draft → Pending → Approved → Retired,
// with immutable version history; exactly one current-approved version per
// identity. Employees never silently edit an approved answer.
// ---------------------------------------------------------------------------

/** A caller can see an answer if it is group-wide (brand-null) or its brand is in
 *  their answer brand-scope. Answers are brand-scoped (country is an optional
 *  attribute of the answer, not a hard access dimension), so brand-level access
 *  is the rule — a brand+country agent sees that brand's answers regardless of
 *  the answer's country. */
function assertAnswerScope(principal: Principal, brandId: string | null): void {
  if (!canAnywhere(principal, "answers.view")) throw new ForbiddenError("answers.view");
  if (brandId == null) return;
  const ids = answerBrandScope(principal);
  if (ids !== "all" && !ids.includes(brandId)) throw new ForbiddenError("answers.view");
}

/** Brand ids a principal may see answers for (brand-level; ignores other-dim
 *  restrictions so a brand+country agent still sees that brand's answers).
 *  Returns "all" for an unrestricted (or super) grant. */
function answerBrandScope(principal: Principal): "all" | string[] {
  if (principal.isSuperAdmin) return "all";
  const ids = new Set<string>();
  for (const a of principal.assignments) {
    if (a.expiresAt && a.expiresAt.getTime() <= Date.now()) continue;
    if (!(a.permissionKeys.has("*") || a.permissionKeys.has("answers.view") || a.permissionKeys.has("answers.manage"))) continue;
    if (a.brandId == null) return "all"; // grant not restricted to a brand ⇒ all brands
    ids.add(a.brandId);
  }
  return [...ids];
}

export async function getAnswer(principal: Principal, id: string) {
  const answer = await prisma.approvedAnswer.findUnique({ where: { id }, include: { versions: { orderBy: { version: "desc" } } } });
  if (!answer || answer.archivedAt) return null;
  assertAnswerScope(principal, answer.brandId);
  return answer;
}

export const answerInputSchema = z.object({
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(20000),
  brandId: optionalString,
  productId: optionalString,
  countryId: optionalString,
  category: optionalString,
  language: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().min(2).max(5).default("en")),
});

/** Create a new answer identity with a version-1 DRAFT. */
export async function createAnswerDraft(ctx: ActorContext, raw: unknown): Promise<ApprovedAnswer> {
  const input = answerInputSchema.parse(raw);
  assertCan(ctx.principal, "answers.create", { brandId: input.brandId ?? null });
  const answer = await prisma.$transaction(async (tx) => {
    const a = await tx.approvedAnswer.create({
      data: {
        question: input.question, answer: "", brandId: input.brandId ?? null, productId: input.productId ?? null,
        countryId: input.countryId ?? null, category: input.category ?? null, language: input.language,
        status: "draft", version: 1, authorId: ctx.principal.userId,
      },
    });
    const v = await tx.answerVersion.create({ data: { answerId: a.id, version: 1, answer: input.answer, status: "draft", authorId: ctx.principal.userId } });
    return tx.approvedAnswer.update({ where: { id: a.id }, data: { currentVersionId: v.id } });
  });
  await audit(ctx, { action: "answer.drafted", entityType: "ApprovedAnswer", entityId: answer.id, summary: input.question.slice(0, 120), brandId: answer.brandId });
  return answer;
}

async function loadEditableAnswer(ctx: ActorContext, id: string): Promise<ApprovedAnswer> {
  const a = await prisma.approvedAnswer.findUnique({ where: { id } });
  if (!a || a.archivedAt) throw new ServiceError("not_found", "Answer not found", 404);
  assertCan(ctx.principal, "answers.edit", { brandId: a.brandId });
  return a;
}

/** Edit the working DRAFT version's content/metadata (only while a draft exists). */
export async function updateAnswerDraft(ctx: ActorContext, id: string, raw: unknown): Promise<void> {
  const a = await loadEditableAnswer(ctx, id);
  const input = answerInputSchema.partial().parse(raw);
  const draft = await prisma.answerVersion.findFirst({ where: { answerId: id, status: "draft" }, orderBy: { version: "desc" } });
  if (!draft) throw new ServiceError("no_draft", "There is no draft to edit. Create a new revision first.", 422);
  await prisma.$transaction(async (tx) => {
    if (input.answer !== undefined) await tx.answerVersion.update({ where: { id: draft.id }, data: { answer: input.answer } });
    const identityData: Record<string, unknown> = {};
    for (const k of ["question", "brandId", "productId", "countryId", "category", "language"] as const) {
      if (input[k] !== undefined) identityData[k] = input[k];
    }
    if (Object.keys(identityData).length) await tx.approvedAnswer.update({ where: { id }, data: identityData });
  });
  await audit(ctx, { action: "answer.draft_updated", entityType: "ApprovedAnswer", entityId: id, summary: "draft updated", brandId: a.brandId });
}

/** Start a NEW revision of an approved answer — a fresh draft version (max+1),
 *  leaving the current approved version in place until the new one is approved. */
export async function createAnswerRevision(ctx: ActorContext, id: string, answerText: string, changeNote?: string): Promise<AnswerVersion> {
  const a = await loadEditableAnswer(ctx, id);
  const existingDraft = await prisma.answerVersion.findFirst({ where: { answerId: id, status: { in: ["draft", "pending"] } } });
  if (existingDraft) throw new ServiceError("draft_exists", "A draft or pending revision already exists.", 422);
  const last = await prisma.answerVersion.findFirst({ where: { answerId: id }, orderBy: { version: "desc" }, select: { version: true } });
  const version = await prisma.answerVersion.create({ data: { answerId: id, version: (last?.version ?? 0) + 1, answer: answerText, status: "draft", authorId: ctx.principal.userId, changeNote: changeNote ?? null } });
  await audit(ctx, { action: "answer.revision_started", entityType: "ApprovedAnswer", entityId: id, summary: `v${version.version} draft`, brandId: a.brandId });
  return version;
}

export async function submitAnswerForApproval(ctx: ActorContext, id: string): Promise<void> {
  const a = await loadEditableAnswer(ctx, id);
  const draft = await prisma.answerVersion.findFirst({ where: { answerId: id, status: "draft" }, orderBy: { version: "desc" } });
  if (!draft) throw new ServiceError("no_draft", "No draft to submit.", 422);
  if (!draft.answer.trim()) throw new ServiceError("empty", "The answer is empty.", 422);
  await prisma.$transaction([
    prisma.answerVersion.update({ where: { id: draft.id }, data: { status: "pending" } }),
    prisma.approvedAnswer.update({ where: { id }, data: { status: a.status === "approved" ? "approved" : "pending" } }),
  ]);
  await audit(ctx, { action: "answer.submitted", entityType: "ApprovedAnswer", entityId: id, summary: `v${draft.version} pending approval`, brandId: a.brandId });
}

/**
 * Approve the pending version. Requires answers.approve in scope. Supersedes any
 * previously-approved version (marked retired) so exactly one is current, then
 * updates the identity's denormalized current text/version.
 */
export async function approveAnswer(ctx: ActorContext, id: string): Promise<void> {
  const a = await prisma.approvedAnswer.findUnique({ where: { id } });
  if (!a || a.archivedAt) throw new ServiceError("not_found", "Answer not found", 404);
  assertCan(ctx.principal, "answers.approve", { brandId: a.brandId });
  const pending = await prisma.answerVersion.findFirst({ where: { answerId: id, status: "pending" }, orderBy: { version: "desc" } });
  if (!pending) throw new ServiceError("no_pending", "No pending version to approve.", 422);
  const now = new Date();
  await prisma.$transaction([
    prisma.answerVersion.updateMany({ where: { answerId: id, status: "approved" }, data: { status: "retired" } }),
    prisma.answerVersion.update({ where: { id: pending.id }, data: { status: "approved", approvedById: ctx.principal.userId, effectiveAt: now } }),
    prisma.approvedAnswer.update({ where: { id }, data: { status: "approved", answer: pending.answer, version: pending.version, currentVersionId: pending.id, approvedById: ctx.principal.userId, effectiveDate: now } }),
  ]);
  await audit(ctx, { action: "answer.approved", entityType: "ApprovedAnswer", entityId: id, summary: `v${pending.version} approved`, brandId: a.brandId });
}

export async function retireAnswer(ctx: ActorContext, id: string): Promise<void> {
  const a = await loadEditableAnswer(ctx, id);
  await prisma.$transaction([
    prisma.approvedAnswer.update({ where: { id }, data: { status: "retired" } }),
    prisma.answerVersion.updateMany({ where: { answerId: id, status: "approved" }, data: { status: "retired" } }),
  ]);
  await audit(ctx, { action: "answer.retired", entityType: "ApprovedAnswer", entityId: id, summary: a.question.slice(0, 100), brandId: a.brandId });
}

/** Record a lightweight copy/use event (§16). */
export async function recordAnswerUsage(ctx: ActorContext, answerId: string, caseId?: string): Promise<void> {
  const a = await prisma.approvedAnswer.findUnique({ where: { id: answerId } });
  if (!a) throw new ServiceError("not_found", "Answer not found", 404);
  assertAnswerScope(ctx.principal, a.brandId);
  await prisma.answerUsage.create({ data: { answerId, versionId: a.currentVersionId, userId: ctx.principal.userId, caseId: caseId ?? null } });
}

// --- Request New Answer (§14) ---------------------------------------------

export const answerRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  brandId: optionalString,
  productId: optionalString,
  countryId: optionalString,
  context: optionalString,
});

export async function createAnswerRequest(ctx: ActorContext, raw: unknown) {
  const input = answerRequestSchema.parse(raw);
  assertAnswerScope(ctx.principal, input.brandId ?? null);
  const req = await prisma.answerRequest.create({
    data: { question: input.question, brandId: input.brandId ?? null, productId: input.productId ?? null, countryId: input.countryId ?? null, context: input.context ?? null, requesterId: ctx.principal.userId, status: "pending" },
  });
  await audit(ctx, { action: "answer_request.created", entityType: "AnswerRequest", entityId: req.id, summary: input.question.slice(0, 120), brandId: req.brandId });
  return req;
}

export async function listAnswerRequests(principal: Principal, status = "pending") {
  const ids = answerBrandScope(principal);
  return prisma.answerRequest.findMany({
    where: { status, ...(ids === "all" ? {} : { OR: [{ brandId: null }, { brandId: { in: ids } }] }) },
    orderBy: { createdAt: "desc" }, take: 100,
  });
}

/** Search approved answers for the Customer Case integration (§17). */
export async function findApprovedAnswers(principal: Principal, filter: { q?: string; brandId?: string | null; productId?: string | null; countryId?: string | null; language?: string }): Promise<ApprovedAnswer[]> {
  const ids = answerBrandScope(principal);
  return prisma.approvedAnswer.findMany({
    where: {
      archivedAt: null, status: "approved",
      ...(ids === "all" ? {} : { OR: [{ brandId: null }, { brandId: { in: ids } }] }),
      ...(filter.brandId ? { OR: [{ brandId: filter.brandId }, { brandId: null }] } : {}),
      ...(filter.productId ? { productId: filter.productId } : {}),
      ...(filter.countryId ? { OR: [{ countryId: filter.countryId }, { countryId: null }] } : {}),
      ...(filter.language ? { language: filter.language } : {}),
      ...(filter.q ? { OR: [{ question: { contains: filter.q, mode: "insensitive" } }, { answer: { contains: filter.q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { updatedAt: "desc" }, take: 20,
  });
}

/** Whether the caller may approve answers in a brand's scope (for UI gating). */
export function canApproveAnswers(principal: Principal, brandId: string | null): boolean {
  return can(principal, "answers.approve", { brandId });
}
