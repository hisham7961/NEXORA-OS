import { z } from "zod";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan, audit, notify, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation";

/**
 * Record comments (§Phase4-23). A reusable contextual-discussion component on any
 * entity (task, campaign, registration, customer case, invoice, product, store, …).
 * Distinct from Discussion Channels (team communication): comments are per-record.
 *
 * Access is permission-aware: each entity type maps to the module-view permission,
 * so a user who cannot view the module cannot read/post its comments. (Comments are
 * reached from an already-guarded detail page; module-level gating blocks direct API
 * access from users with no access to that domain.)
 */
const ENTITY_PERMISSION: Record<string, string> = {
  task: "tasks.view", project: "projects.view", campaign: "campaigns.view", whatsapp: "campaigns.view",
  design: "creative.view", registration: "registrations.view", document: "documents.view",
  customer_case: "cases.view", product: "products.view", store: "stores.view", brand: "brands.view",
  invoice: "ar.view", credit_note: "ar.view", receipt: "payments.view", bill: "ap.view",
  supplier_bill: "ap.view", supplier: "ap.view", customer: "ar.view", subscription: "subscriptions.view",
  knowledge: "knowledge.view", answer: "answers.view",
};

function permFor(entityType: string): string {
  const p = ENTITY_PERMISSION[entityType];
  if (!p) throw new ServiceError("unsupported_entity", "Comments are not enabled for this entity type.", 422);
  return p;
}

const MENTION_RE = /@([a-z0-9._-]+)/gi;

async function resolveMentions(body: string): Promise<string[]> {
  const handles = [...new Set([...body.matchAll(MENTION_RE)].map((m) => m[1].toLowerCase()))];
  if (!handles.length) return [];
  const users = await prisma.user.findMany({ where: { OR: handles.flatMap((h) => [{ email: { startsWith: `${h}@`, mode: "insensitive" as const } }, { name: { contains: h, mode: "insensitive" as const } }]) }, select: { id: true }, take: 10 });
  return [...new Set(users.map((u) => u.id))];
}

export const commentSchema = z.object({
  entityType: z.string().trim().min(1).max(40),
  entityId: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(5000),
  parentId: optionalString,
});

export async function listComments(principal: Principal, entityType: string, entityId: string) {
  assertCan(principal, permFor(entityType));
  const rows = await prisma.comment.findMany({ where: { entityType, entityId, archivedAt: null }, orderBy: { createdAt: "asc" } });
  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const authors = authorIds.length ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } }) : [];
  const nameById = new Map(authors.map((a) => [a.id, a.name]));
  return rows.map((r) => ({ id: r.id, body: r.body, authorId: r.authorId, authorName: nameById.get(r.authorId) ?? "Unknown", parentId: r.parentId, editedAt: r.editedAt, createdAt: r.createdAt }));
}

export async function addComment(ctx: ActorContext, raw: unknown) {
  const input = commentSchema.parse(raw);
  assertCan(ctx.principal, permFor(input.entityType));
  if (input.parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.entityType !== input.entityType || parent.entityId !== input.entityId) throw new ServiceError("bad_parent", "Reply target not found.", 422);
  }
  const comment = await prisma.comment.create({ data: { authorId: ctx.principal.userId, body: input.body, entityType: input.entityType, entityId: input.entityId, parentId: input.parentId ?? null } });
  const mentioned = await resolveMentions(input.body);
  await notify(mentioned, { type: "mention", title: "You were mentioned in a comment", body: input.body.slice(0, 140), entityType: input.entityType, entityId: input.entityId }, ctx.principal.userId);
  await audit(ctx, { action: "comment.added", entityType: input.entityType, entityId: input.entityId, summary: input.body.slice(0, 80) });
  return comment;
}

export async function editComment(ctx: ActorContext, id: string, body: string) {
  const c = await prisma.comment.findUnique({ where: { id } });
  if (!c || c.archivedAt) throw new ServiceError("not_found", "Comment not found", 404);
  if (c.authorId !== ctx.principal.userId) throw new ServiceError("forbidden", "You can only edit your own comment.", 403);
  const updated = await prisma.comment.update({ where: { id }, data: { body: body.trim().slice(0, 5000), editedAt: new Date() } });
  return updated;
}

export async function deleteComment(ctx: ActorContext, id: string) {
  const c = await prisma.comment.findUnique({ where: { id } });
  if (!c || c.archivedAt) throw new ServiceError("not_found", "Comment not found", 404);
  const canModerate = c.authorId === ctx.principal.userId;
  if (!canModerate) throw new ServiceError("forbidden", "You can only delete your own comment.", 403);
  await prisma.comment.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit(ctx, { action: "comment.deleted", entityType: c.entityType, entityId: c.entityId, summary: "comment removed" });
}
