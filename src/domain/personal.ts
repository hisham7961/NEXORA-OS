import { z } from "zod";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation";

/**
 * Personal productivity surfaces (§Phase4-9/10/11): Saved Views, Favorites and
 * Recent Items. All are per-user personal bookmarks. Permission/scope is always
 * enforced when OPENING the target (the destination page guards), so a bookmark
 * never grants access the user has since lost; a Saved View just restores filters.
 */

// ---------------------------------------------------------------------------
// Saved Views
// ---------------------------------------------------------------------------
export const savedViewSchema = z.object({
  module: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(80),
  filtersJson: z.string().max(4000), // the list's query string
  isShared: z.boolean().default(false),
});

export async function listSavedViews(principal: Principal, module: string) {
  return prisma.savedView.findMany({
    where: { module, OR: [{ userId: principal.userId }, { isShared: true }] },
    orderBy: [{ name: "asc" }],
  });
}

export async function saveView(ctx: ActorContext, raw: unknown) {
  const input = savedViewSchema.parse(raw);
  const view = await prisma.savedView.create({
    data: { userId: ctx.principal.userId, module: input.module, name: input.name, filtersJson: input.filtersJson, isShared: input.isShared },
  });
  return view;
}

export async function renameSavedView(ctx: ActorContext, id: string, name: string) {
  const v = await prisma.savedView.findUnique({ where: { id } });
  if (!v || v.userId !== ctx.principal.userId) throw new ServiceError("not_found", "View not found", 404);
  return prisma.savedView.update({ where: { id }, data: { name: name.trim().slice(0, 80) } });
}

export async function deleteSavedView(ctx: ActorContext, id: string) {
  const v = await prisma.savedView.findUnique({ where: { id } });
  if (!v || v.userId !== ctx.principal.userId) throw new ServiceError("not_found", "View not found", 404);
  await prisma.savedView.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------
export const favoriteSchema = z.object({
  entityType: z.string().trim().min(1).max(40),
  entityId: z.string().trim().min(1).max(60),
  label: optionalString,
  href: optionalString,
});

export async function toggleFavorite(ctx: ActorContext, raw: unknown): Promise<{ favorited: boolean }> {
  const input = favoriteSchema.parse(raw);
  const key = { userId: ctx.principal.userId, entityType: input.entityType, entityId: input.entityId };
  const existing = await prisma.favorite.findUnique({ where: { userId_entityType_entityId: key } });
  if (existing) { await prisma.favorite.delete({ where: { id: existing.id } }); return { favorited: false }; }
  await prisma.favorite.create({ data: { ...key, label: input.label ?? null, href: input.href ?? null } });
  return { favorited: true };
}

export async function listFavorites(principal: Principal, take = 100) {
  return prisma.favorite.findMany({ where: { userId: principal.userId }, orderBy: { createdAt: "desc" }, take });
}

export async function favoritedIds(principal: Principal, entityType: string): Promise<Set<string>> {
  const rows = await prisma.favorite.findMany({ where: { userId: principal.userId, entityType }, select: { entityId: true } });
  return new Set(rows.map((r) => r.entityId));
}

// ---------------------------------------------------------------------------
// Recent Items (bounded per-user history)
// ---------------------------------------------------------------------------
const RECENT_LIMIT = 20;

export async function trackRecent(ctx: ActorContext, input: { entityType: string; entityId: string; label?: string; href?: string }) {
  if (!input.entityType || !input.entityId) return;
  const key = { userId: ctx.principal.userId, entityType: input.entityType.slice(0, 40), entityId: input.entityId.slice(0, 60) };
  await prisma.recentItem.upsert({
    where: { userId_entityType_entityId: key },
    create: { ...key, label: input.label?.slice(0, 160) ?? null, href: input.href?.slice(0, 300) ?? null, viewedAt: new Date() },
    update: { viewedAt: new Date(), label: input.label?.slice(0, 160) ?? null, href: input.href?.slice(0, 300) ?? null },
  });
  // Prune to the most recent RECENT_LIMIT.
  const excess = await prisma.recentItem.findMany({ where: { userId: ctx.principal.userId }, orderBy: { viewedAt: "desc" }, skip: RECENT_LIMIT, select: { id: true } });
  if (excess.length) await prisma.recentItem.deleteMany({ where: { id: { in: excess.map((e) => e.id) } } });
}

export async function listRecent(principal: Principal, take = RECENT_LIMIT) {
  return prisma.recentItem.findMany({ where: { userId: principal.userId }, orderBy: { viewedAt: "desc" }, take });
}
