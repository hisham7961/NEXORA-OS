import { z } from "zod";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { audit, notify, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation";

/**
 * Record comments (§Phase4-23). A reusable contextual-discussion component on any
 * entity (task, campaign, registration, customer case, invoice, product, store, …).
 * Distinct from Discussion Channels (team communication): comments are per-record.
 *
 * Access is fail-closed PER RECORD (audit ARCH-03, §69): reading or posting a
 * comment loads the referenced record and runs `assertRecordInScope` on the SAME
 * dimensions that gate the record's own module — so a user who holds e.g. tasks.view
 * only in Brand A cannot reach the comments of a Brand B task. A module-only check
 * (`can(principal, "tasks.view")` with no scope) was an IDOR: it passed for anyone
 * with the permission in any scope. The comment API and server actions take an
 * arbitrary entityId, so the guard runs there, not just behind the detail page.
 */
type Dim = "companyId" | "brandId" | "countryId";

interface EntityScope {
  perm: string;
  dims: Dim[];
  /** Load only the scope columns of the referenced record (null when it doesn't exist). */
  load: (id: string) => Promise<Partial<Record<Dim, string | null>> | null>;
}

/** Build a config from a Prisma delegate that selects just the record's scope dims. */
function scoped(perm: string, delegate: { findUnique: (args: { where: { id: string }; select: Record<string, boolean> }) => Promise<unknown> }, dims: Dim[]): EntityScope {
  const select = Object.fromEntries(dims.map((d) => [d, true]));
  return { perm, dims, load: (id) => delegate.findUnique({ where: { id }, select }) as Promise<Partial<Record<Dim, string | null>> | null> };
}

/**
 * entityType → how to scope-check its record. Model names and scope columns are
 * verified against prisma/schema.prisma; each maps to the record's module-view
 * permission and the exact dimensions that record carries.
 */
const ENTITY_SCOPE: Record<string, EntityScope> = {
  task: scoped("tasks.view", prisma.task, ["companyId", "brandId", "countryId"]),
  project: scoped("projects.view", prisma.project, ["companyId", "brandId"]),
  campaign: scoped("campaigns.view", prisma.campaign, ["companyId", "brandId", "countryId"]),
  whatsapp: scoped("campaigns.view", prisma.whatsappCampaign, ["brandId", "countryId"]),
  design: scoped("design.view", prisma.designRequest, ["companyId", "brandId", "countryId"]),
  registration: scoped("registrations.view", prisma.registrationCase, ["companyId", "brandId", "countryId"]),
  document: scoped("documents.view", prisma.document, ["companyId", "brandId", "countryId"]),
  customer_case: scoped("cases.view", prisma.customerCase, ["companyId", "brandId", "countryId"]),
  product: scoped("products.view", prisma.product, ["brandId"]),
  store: scoped("stores.view", prisma.store, ["companyId", "brandId", "countryId"]),
  invoice: scoped("ar.view", prisma.salesInvoice, ["companyId", "brandId", "countryId"]),
  credit_note: scoped("ar.view", prisma.creditNote, ["companyId", "brandId", "countryId"]),
  receipt: scoped("payments.view", prisma.customerReceipt, ["companyId", "brandId", "countryId"]),
  bill: scoped("ap.view", prisma.supplierBill, ["companyId", "brandId", "countryId"]),
  supplier_bill: scoped("ap.view", prisma.supplierBill, ["companyId", "brandId", "countryId"]),
  supplier: scoped("ap.view", prisma.supplier, ["companyId", "brandId", "countryId"]),
  customer: scoped("ar.view", prisma.customer, ["companyId", "brandId", "countryId"]),
  subscription: scoped("subscriptions.view", prisma.subscription, ["companyId", "brandId", "countryId"]),
  knowledge: scoped("knowledge.view", prisma.knowledgeArticle, ["brandId", "countryId"]),
  answer: scoped("answers.view", prisma.approvedAnswer, ["brandId", "countryId"]),
  // Brand is an org entity: its OWN id is the brand-scope value (§ accessibleScopeIds).
  brand: {
    perm: "brands.view",
    dims: ["brandId"],
    load: async (id) => { const b = await prisma.brand.findUnique({ where: { id }, select: { id: true } }); return b ? { brandId: b.id } : null; },
  },
};

/** Fail-closed: the actor must be able to view the referenced record in its own scope. */
async function assertEntityInScope(principal: Principal, entityType: string, entityId: string): Promise<void> {
  const cfg = ENTITY_SCOPE[entityType];
  if (!cfg) throw new ServiceError("unsupported_entity", "Comments are not enabled for this entity type.", 422);
  const record = await cfg.load(entityId);
  if (!record) throw new ServiceError("not_found", "Record not found", 404);
  assertRecordInScope(principal, cfg.perm, record, cfg.dims);
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
  await assertEntityInScope(principal, entityType, entityId);
  const rows = await prisma.comment.findMany({ where: { entityType, entityId, archivedAt: null }, orderBy: { createdAt: "asc" } });
  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const authors = authorIds.length ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } }) : [];
  const nameById = new Map(authors.map((a) => [a.id, a.name]));
  return rows.map((r) => ({ id: r.id, body: r.body, authorId: r.authorId, authorName: nameById.get(r.authorId) ?? "Unknown", parentId: r.parentId, editedAt: r.editedAt, createdAt: r.createdAt }));
}

export async function addComment(ctx: ActorContext, raw: unknown) {
  const input = commentSchema.parse(raw);
  await assertEntityInScope(ctx.principal, input.entityType, input.entityId);
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
