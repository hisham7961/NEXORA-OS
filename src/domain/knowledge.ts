import { z } from "zod";
import type { KnowledgeArticle, KnowledgeVersion } from "@prisma/client";
import { prisma } from "@/lib/db";
import { can, canAnywhere, ForbiddenError, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { optionalString, optionalDate } from "@/lib/validation";

/** Internal Knowledge Base (§18–20). */
export const knowledgeQuerySchema = listQuerySchema.extend({ category: z.string().optional(), status: z.string().optional() });
export type KnowledgeQuery = z.infer<typeof knowledgeQuerySchema>;

/** Brand ids a principal may see articles for (brand-level; brand-null = global). */
function knowledgeBrandScope(principal: Principal): "all" | string[] {
  if (principal.isSuperAdmin) return "all";
  const ids = new Set<string>();
  for (const a of principal.assignments) {
    if (a.expiresAt && a.expiresAt.getTime() <= Date.now()) continue;
    if (!(a.permissionKeys.has("*") || a.permissionKeys.has("knowledge.view") || a.permissionKeys.has("knowledge.manage"))) continue;
    if (a.brandId == null) return "all";
    ids.add(a.brandId);
  }
  return [...ids];
}

function assertKnowledgeScope(principal: Principal, brandId: string | null): void {
  if (!canAnywhere(principal, "knowledge.view")) throw new ForbiddenError("knowledge.view");
  if (brandId == null) return;
  const ids = knowledgeBrandScope(principal);
  if (ids !== "all" && !ids.includes(brandId)) throw new ForbiddenError("knowledge.view");
}

export async function listKnowledge(principal: Principal, query: KnowledgeQuery): Promise<{ rows: KnowledgeArticle[]; total: number }> {
  const ids = knowledgeBrandScope(principal);
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...(ids === "all" ? {} : { OR: [{ brandId: null }, { brandId: { in: ids } }] }),
    ...(query.category ? { category: query.category } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { title: { contains: query.q, mode: "insensitive" } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.knowledgeArticle.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.knowledgeArticle.count({ where }),
  ]);
  return { rows, total };
}

// ---------------------------------------------------------------------------
// KNOWLEDGE LIFECYCLE (§18–19). Draft → In review → Published → Archived, with
// immutable version history; exactly one current-published version per article.
// ---------------------------------------------------------------------------

const CATEGORIES = ["sop", "company_policy", "brand_info", "product_info", "marketing", "customer_service", "regulatory", "commerce", "creative", "hr_ops", "custom"] as const;

function parseTags(json: string | null): string[] {
  if (!json) return [];
  try { const v = JSON.parse(json); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}

export async function getArticle(principal: Principal, id: string) {
  const article = await prisma.knowledgeArticle.findUnique({ where: { id }, include: { versions: { orderBy: { version: "desc" } } } });
  if (!article || article.archivedAt) return null;
  assertKnowledgeScope(principal, article.brandId);
  return { ...article, tags: parseTags(article.tagsJson) };
}

export const articleInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(100000),
  category: z.enum(CATEGORIES).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  brandId: optionalString,
  productId: optionalString,
  countryId: optionalString,
  reviewerId: optionalString,
  reviewDueAt: optionalDate,
});

export async function createArticleDraft(ctx: ActorContext, raw: unknown): Promise<KnowledgeArticle> {
  const input = articleInputSchema.parse(raw);
  assertCan(ctx.principal, "knowledge.create", { brandId: input.brandId ?? null });
  const article = await prisma.$transaction(async (tx) => {
    const a = await tx.knowledgeArticle.create({
      data: {
        title: input.title, body: "", category: input.category ?? null, tagsJson: input.tags?.length ? JSON.stringify(input.tags) : null,
        brandId: input.brandId ?? null, productId: input.productId ?? null, countryId: input.countryId ?? null,
        reviewerId: input.reviewerId ?? null, reviewDueAt: input.reviewDueAt ?? null, authorId: ctx.principal.userId,
        status: "draft", version: 1,
      },
    });
    const v = await tx.knowledgeVersion.create({ data: { articleId: a.id, version: 1, title: input.title, body: input.body, status: "draft", authorId: ctx.principal.userId } });
    return tx.knowledgeArticle.update({ where: { id: a.id }, data: { currentVersionId: v.id } });
  });
  await audit(ctx, { action: "knowledge.drafted", entityType: "KnowledgeArticle", entityId: article.id, summary: input.title.slice(0, 120), brandId: article.brandId });
  return article;
}

async function loadEditableArticle(ctx: ActorContext, id: string): Promise<KnowledgeArticle> {
  const a = await prisma.knowledgeArticle.findUnique({ where: { id } });
  if (!a || a.archivedAt) throw new ServiceError("not_found", "Article not found", 404);
  assertCan(ctx.principal, "knowledge.edit", { brandId: a.brandId });
  return a;
}

export async function updateArticleDraft(ctx: ActorContext, id: string, raw: unknown): Promise<void> {
  const a = await loadEditableArticle(ctx, id);
  const input = articleInputSchema.partial().parse(raw);
  const draft = await prisma.knowledgeVersion.findFirst({ where: { articleId: id, status: { in: ["draft", "in_review"] } }, orderBy: { version: "desc" } });
  if (!draft) throw new ServiceError("no_draft", "No draft to edit — start a new revision first.", 422);
  await prisma.$transaction(async (tx) => {
    const vData: Record<string, unknown> = {};
    if (input.title !== undefined) vData.title = input.title;
    if (input.body !== undefined) vData.body = input.body;
    if (Object.keys(vData).length) await tx.knowledgeVersion.update({ where: { id: draft.id }, data: vData });
    const aData: Record<string, unknown> = {};
    for (const k of ["title", "category", "brandId", "productId", "countryId", "reviewerId", "reviewDueAt"] as const) {
      if (input[k] !== undefined) aData[k] = input[k];
    }
    if (input.tags !== undefined) aData.tagsJson = input.tags.length ? JSON.stringify(input.tags) : null;
    if (Object.keys(aData).length) await tx.knowledgeArticle.update({ where: { id }, data: aData });
  });
  await audit(ctx, { action: "knowledge.draft_updated", entityType: "KnowledgeArticle", entityId: id, summary: "draft updated", brandId: a.brandId });
}

export async function submitArticleForReview(ctx: ActorContext, id: string): Promise<void> {
  const a = await loadEditableArticle(ctx, id);
  const draft = await prisma.knowledgeVersion.findFirst({ where: { articleId: id, status: "draft" }, orderBy: { version: "desc" } });
  if (!draft) throw new ServiceError("no_draft", "No draft to submit.", 422);
  await prisma.$transaction([
    prisma.knowledgeVersion.update({ where: { id: draft.id }, data: { status: "in_review" } }),
    prisma.knowledgeArticle.update({ where: { id }, data: { status: a.status === "published" ? "published" : "in_review" } }),
  ]);
  await audit(ctx, { action: "knowledge.submitted", entityType: "KnowledgeArticle", entityId: id, summary: `v${draft.version} in review`, brandId: a.brandId });
}

/** Approve + publish the in-review version. Requires knowledge.approve. Supersedes
 *  the prior published version and becomes the single current published one. */
export async function publishArticle(ctx: ActorContext, id: string): Promise<void> {
  const a = await prisma.knowledgeArticle.findUnique({ where: { id } });
  if (!a || a.archivedAt) throw new ServiceError("not_found", "Article not found", 404);
  assertCan(ctx.principal, "knowledge.approve", { brandId: a.brandId });
  const review = await prisma.knowledgeVersion.findFirst({ where: { articleId: id, status: "in_review" }, orderBy: { version: "desc" } });
  if (!review) throw new ServiceError("no_review", "No in-review version to publish.", 422);
  const now = new Date();
  await prisma.$transaction([
    prisma.knowledgeVersion.updateMany({ where: { articleId: id, status: "published" }, data: { status: "superseded" } }),
    prisma.knowledgeVersion.update({ where: { id: review.id }, data: { status: "published", approvedById: ctx.principal.userId, publishedAt: now } }),
    prisma.knowledgeArticle.update({ where: { id }, data: { status: "published", title: review.title, body: review.body, version: review.version, currentVersionId: review.id, lastReviewedAt: now } }),
  ]);
  await audit(ctx, { action: "knowledge.published", entityType: "KnowledgeArticle", entityId: id, summary: `v${review.version} published`, brandId: a.brandId });
}

export async function createArticleRevision(ctx: ActorContext, id: string, body: string, changeNote?: string, title?: string): Promise<KnowledgeVersion> {
  const a = await loadEditableArticle(ctx, id);
  const open = await prisma.knowledgeVersion.findFirst({ where: { articleId: id, status: { in: ["draft", "in_review"] } } });
  if (open) throw new ServiceError("draft_exists", "A draft or in-review revision already exists.", 422);
  const last = await prisma.knowledgeVersion.findFirst({ where: { articleId: id }, orderBy: { version: "desc" }, select: { version: true } });
  const v = await prisma.knowledgeVersion.create({ data: { articleId: id, version: (last?.version ?? 0) + 1, title: title ?? a.title, body, status: "draft", authorId: ctx.principal.userId, changeNote: changeNote ?? null } });
  await audit(ctx, { action: "knowledge.revision_started", entityType: "KnowledgeArticle", entityId: id, summary: `v${v.version} draft`, brandId: a.brandId });
  return v;
}

export async function archiveArticle(ctx: ActorContext, id: string): Promise<void> {
  const a = await loadEditableArticle(ctx, id);
  await prisma.knowledgeArticle.update({ where: { id }, data: { status: "archived", archivedAt: new Date() } });
  await audit(ctx, { action: "knowledge.archived", entityType: "KnowledgeArticle", entityId: id, summary: a.title.slice(0, 100), brandId: a.brandId });
}

export async function markArticleReviewed(ctx: ActorContext, id: string, reviewDueAt?: Date): Promise<void> {
  const a = await loadEditableArticle(ctx, id);
  await prisma.knowledgeArticle.update({ where: { id }, data: { lastReviewedAt: new Date(), reviewDueAt: reviewDueAt ?? a.reviewDueAt } });
  await audit(ctx, { action: "knowledge.reviewed", entityType: "KnowledgeArticle", entityId: id, summary: "marked reviewed", brandId: a.brandId });
}

/** Published-article search for global search / Cmd-K (§20). */
export async function searchKnowledge(principal: Principal, q: string, take = 5) {
  if (!q.trim()) return [];
  const ids = knowledgeBrandScope(principal);
  return prisma.knowledgeArticle.findMany({
    where: {
      archivedAt: null, status: "published",
      ...(ids === "all" ? {} : { OR: [{ brandId: null }, { brandId: { in: ids } }] }),
      OR: [{ title: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }],
    },
    orderBy: { updatedAt: "desc" }, take,
  });
}

export function canApproveKnowledge(principal: Principal, brandId: string | null): boolean {
  return can(principal, "knowledge.approve", { brandId });
}
