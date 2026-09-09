import { z } from "zod";
import type { PublishingItem } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere } from "@/domain/scope";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, notify, type ActorContext } from "@/domain/mutation";
import { optionalString, optionalDate } from "@/lib/validation";

/** PublishingItem carries brand + country (no company column). */
const DIMS_BC = ["brandId", "countryId"] as const;

/** Social publishing control (§10) — planning/scheduling/verification, not an API publisher. */
export const socialQuerySchema = listQuerySchema.extend({ status: z.string().optional(), platform: z.string().optional(), brandId: z.string().optional() });
export type SocialQuery = z.infer<typeof socialQuerySchema>;

export async function listPublishing(principal: Principal, query: SocialQuery): Promise<{ rows: PublishingItem[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "social.view", ["brandId", "countryId"], {
      ...(query.status ? { status: query.status } : {}),
      ...(query.platform ? { platform: query.platform } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ caption: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.publishingItem.findMany({ where, orderBy: { publishDate: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.publishingItem.count({ where }),
  ]);
  return { rows, total };
}

/**
 * Detail for a single publishing item (§10), fail-closed on scope. Also loads
 * the recurrence it belongs to (if any) for context.
 */
export async function getPublishingItem(principal: Principal, id: string) {
  const item = await prisma.publishingItem.findUnique({ where: { id } });
  if (!item) return null;
  assertRecordInScope(principal, "social.view", { brandId: item.brandId, countryId: item.countryId }, [...DIMS_BC]);
  const recurrence = item.recurrenceId ? await prisma.publishingRecurrence.findUnique({ where: { id: item.recurrenceId } }) : null;
  return { item, recurrence };
}

/**
 * Coverage matrix (§10): for the caller's accessible scope, how many items are
 * planned per platform over the next `days` days — the gaps are what matters.
 */
export async function getCoverageMatrix(principal: Principal, days = 7) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + days * 86_400_000);
  const where = {
    archivedAt: null,
    publishDate: { gte: start, lt: end },
    ...scopedWhere(principal, "social.view", [...DIMS_BC], {}),
  };
  const items = await prisma.publishingItem.findMany({
    where,
    select: { platform: true, publishDate: true, status: true },
  });
  const dayKeys = Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  const platforms = [...new Set(items.map((i) => i.platform ?? "unspecified"))].sort();
  const grid: Record<string, Record<string, number>> = {};
  for (const p of platforms) grid[p] = Object.fromEntries(dayKeys.map((d) => [d, 0]));
  for (const i of items) {
    const p = i.platform ?? "unspecified";
    const d = i.publishDate ? new Date(i.publishDate).toISOString().slice(0, 10) : null;
    if (d && grid[p] && d in grid[p]) grid[p][d]++;
  }
  return { dayKeys, platforms, grid, total: items.length };
}

// ---------------------------------------------------------------------------
// WRITE PATHS (§10, Phase 2 Part L/M) — plan → schedule → publish, verified as
// two explicit checkpoints, plus a recurring generator (idempotent).
// ---------------------------------------------------------------------------

const CONTENT_TYPES = ["post", "story", "reel", "video", "carousel", "live", "custom"] as const;
const PUBLISHING_STATUSES = ["idea", "requested", "copywriting", "design", "review", "approved", "scheduled", "published", "failed", "cancelled"] as const;
const PLATFORMS = ["instagram", "facebook", "tiktok", "snapchat", "youtube", "x", "linkedin", "custom"] as const;

export const publishingInputSchema = z.object({
  contentType: z.enum(CONTENT_TYPES).default("post"),
  platform: z.enum(PLATFORMS).optional(),
  brandId: optionalString,
  countryId: optionalString,
  socialAccountId: optionalString,
  productId: optionalString,
  campaignId: optionalString,
  publishDate: optionalDate,
  publishTime: optionalString,
  caption: optionalString,
  ownerId: optionalString,
  designerId: optionalString,
  notes: optionalString,
});

function itemScope(i: { brandId: string | null; countryId: string | null }) {
  return { brandId: i.brandId, countryId: i.countryId };
}

export async function createPublishingItem(ctx: ActorContext, raw: unknown): Promise<PublishingItem> {
  const input = publishingInputSchema.parse(raw);
  const scope = { brandId: input.brandId ?? null, countryId: input.countryId ?? null };
  assertCan(ctx.principal, "social.create", scope);
  const item = await prisma.publishingItem.create({
    data: {
      contentType: input.contentType, platform: input.platform ?? null, ...scope,
      socialAccountId: input.socialAccountId ?? null, productId: input.productId ?? null,
      campaignId: input.campaignId ?? null, publishDate: input.publishDate ?? null,
      publishTime: input.publishTime ?? null, caption: input.caption ?? null,
      ownerId: input.ownerId ?? null, designerId: input.designerId ?? null,
      notes: input.notes ?? null, status: "idea",
    },
  });
  await audit(ctx, { action: "publishing.created", entityType: "PublishingItem", entityId: item.id, summary: `${input.contentType}${input.platform ? ` · ${input.platform}` : ""}`, brandId: item.brandId });
  await notify([input.ownerId, input.designerId], { type: "publishing.assigned", title: "You're on a publishing item", body: input.caption ?? input.contentType, entityType: "PublishingItem", entityId: item.id }, ctx.principal.userId);
  return item;
}

async function loadEditableItem(ctx: ActorContext, id: string): Promise<PublishingItem> {
  const item = await prisma.publishingItem.findUnique({ where: { id } });
  if (!item || item.archivedAt) throw new ServiceError("not_found", "Publishing item not found", 404);
  assertRecordInScope(ctx.principal, "social.edit", itemScope(item), [...DIMS_BC]);
  return item;
}

export const publishingUpdateSchema = publishingInputSchema.partial();

export async function updatePublishingItem(ctx: ActorContext, id: string, raw: unknown): Promise<PublishingItem> {
  const existing = await loadEditableItem(ctx, id);
  const input = publishingUpdateSchema.parse(raw);
  const data: Record<string, unknown> = {};
  for (const k of ["contentType", "platform", "socialAccountId", "productId", "campaignId", "publishDate", "publishTime", "caption", "ownerId", "designerId", "notes"] as const) {
    if (input[k] !== undefined) data[k] = input[k];
  }
  const updated = await prisma.publishingItem.update({ where: { id }, data });
  await audit(ctx, { action: "publishing.updated", entityType: "PublishingItem", entityId: id, summary: "updated", brandId: existing.brandId, newValues: data });
  return updated;
}

export async function setPublishingStatus(ctx: ActorContext, id: string, status: string): Promise<PublishingItem> {
  if (!(PUBLISHING_STATUSES as readonly string[]).includes(status)) throw new ServiceError("invalid_status", "Unknown publishing status", 400);
  const existing = await loadEditableItem(ctx, id);
  const updated = await prisma.publishingItem.update({ where: { id }, data: { status } });
  await audit(ctx, { action: "publishing.status_changed", entityType: "PublishingItem", entityId: id, summary: `${existing.status} → ${status}`, brandId: existing.brandId, oldValues: { status: existing.status }, newValues: { status } });
  return updated;
}

/**
 * Checkpoint 1 — confirm the item was actually scheduled in the native tool.
 * This is the human verification the platform is built around (§10), not an API
 * publish. Requires the content to be approved first.
 */
export async function confirmScheduled(ctx: ActorContext, id: string): Promise<PublishingItem> {
  const existing = await loadEditableItem(ctx, id);
  if (!["approved", "scheduled"].includes(existing.status)) {
    throw new ServiceError("not_approved", "Only approved content can be marked scheduled", 422);
  }
  const updated = await prisma.publishingItem.update({
    where: { id },
    data: { status: "scheduled", scheduledConfirmedAt: existing.scheduledConfirmedAt ?? new Date() },
  });
  await audit(ctx, { action: "publishing.scheduled_confirmed", entityType: "PublishingItem", entityId: id, summary: "Scheduling confirmed", brandId: existing.brandId });
  return updated;
}

/**
 * Checkpoint 2 — confirm it went live, capturing the public URL as evidence.
 */
export async function confirmPublished(ctx: ActorContext, id: string, publishedUrl?: string): Promise<PublishingItem> {
  const existing = await loadEditableItem(ctx, id);
  if (!existing.scheduledConfirmedAt) {
    throw new ServiceError("not_scheduled", "Confirm scheduling before marking published", 422);
  }
  const updated = await prisma.publishingItem.update({
    where: { id },
    data: { status: "published", publishedConfirmedAt: new Date(), publishedUrl: publishedUrl?.trim() || existing.publishedUrl },
  });
  await audit(ctx, { action: "publishing.published_confirmed", entityType: "PublishingItem", entityId: id, summary: publishedUrl ? "Published · URL captured" : "Published", brandId: existing.brandId });
  return updated;
}

export const recurrenceInputSchema = z.object({
  brandId: optionalString,
  countryId: optionalString,
  socialAccountId: optionalString,
  productId: optionalString,
  platform: z.enum(PLATFORMS).optional(),
  contentType: z.enum(CONTENT_TYPES).default("story"),
  startDate: z.coerce.date({ invalid_type_error: "A start date is required" }),
  days: z.coerce.number().int().min(1).max(90).default(7),
  ownerId: optionalString,
});

/** Create a recurring plan; the generator materializes items from it (§10). */
export async function createRecurrence(ctx: ActorContext, raw: unknown) {
  const input = recurrenceInputSchema.parse(raw);
  assertCan(ctx.principal, "social.create", { brandId: input.brandId ?? null, countryId: input.countryId ?? null });
  const rec = await prisma.publishingRecurrence.create({
    data: {
      brandId: input.brandId ?? null, productId: input.productId ?? null,
      socialAccountId: input.socialAccountId ?? null, contentType: input.contentType,
      startDate: input.startDate, days: input.days,
      ruleJson: JSON.stringify({ countryId: input.countryId ?? null, platform: input.platform ?? null, ownerId: input.ownerId ?? null }),
      createdById: ctx.principal.userId,
    },
  });
  await audit(ctx, { action: "publishing.recurrence_created", entityType: "PublishingRecurrence", entityId: rec.id, summary: `${input.contentType} ×${input.days} from ${input.startDate.toISOString().slice(0, 10)}`, brandId: rec.brandId });
  const generated = await generateFromRecurrence(rec.id, ctx.principal.userId);
  return { recurrence: rec, ...generated };
}

/** Materialize one recurrence's items, idempotently (skip dates already present). */
export async function generateFromRecurrence(recurrenceId: string, actorId: string | null): Promise<{ created: number; skipped: number }> {
  const rec = await prisma.publishingRecurrence.findUnique({ where: { id: recurrenceId } });
  if (!rec) throw new ServiceError("not_found", "Recurrence not found", 404);
  const rule = rec.ruleJson ? (JSON.parse(rec.ruleJson) as { countryId?: string | null; platform?: string | null; ownerId?: string | null }) : {};
  const base = new Date(rec.startDate);
  const startDay = new Date(base.getFullYear(), base.getMonth(), base.getDate());

  let created = 0;
  let skipped = 0;
  for (let d = 0; d < rec.days; d++) {
    const day = new Date(startDay.getTime() + d * 86_400_000);
    const existing = await prisma.publishingItem.findFirst({
      where: { recurrenceId, publishDate: day },
      select: { id: true },
    });
    if (existing) { skipped++; continue; }
    await prisma.publishingItem.create({
      data: {
        recurrenceId, brandId: rec.brandId, countryId: rule.countryId ?? null,
        socialAccountId: rec.socialAccountId, productId: rec.productId,
        platform: rule.platform ?? null, contentType: rec.contentType,
        publishDate: day, ownerId: rule.ownerId ?? null, status: "idea",
      },
    });
    created++;
  }
  if (actorId) {
    await prisma.auditLog.create({ data: { actorId, action: "job.publishing_recurrence_generated", entityType: "PublishingRecurrence", entityId: recurrenceId, summary: `${created} created, ${skipped} skipped` } });
  }
  return { created, skipped };
}

/** Run the generator across every recurrence — the recurring job (idempotent). */
export async function generateRecurringPublishing(actorId: string | null): Promise<{ created: number; skipped: number; recurrences: number }> {
  const recs = await prisma.publishingRecurrence.findMany({ select: { id: true } });
  let created = 0;
  let skipped = 0;
  for (const r of recs) {
    const res = await generateFromRecurrence(r.id, null);
    created += res.created;
    skipped += res.skipped;
  }
  await prisma.systemEvent.create({
    data: { type: "health", level: "info", message: `Publishing recurrence generator: ${created} created, ${skipped} skipped across ${recs.length} recurrences`, metaJson: JSON.stringify({ created, skipped, recurrences: recs.length }) },
  });
  if (actorId) {
    await prisma.auditLog.create({ data: { actorId, action: "job.publishing_recurrence_run", entityType: "BackgroundJob", summary: `${created} created, ${skipped} skipped` } });
  }
  return { created, skipped, recurrences: recs.length };
}
