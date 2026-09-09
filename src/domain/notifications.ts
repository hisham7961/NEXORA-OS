import { prisma } from "@/lib/db";
import type { Notification } from "@prisma/client";
import type { Principal } from "@/lib/permissions/engine";
import { ServiceError } from "@/lib/api/handler";
import type { ActorContext } from "@/domain/mutation";

/**
 * Notification center 2.0 (§22/§30) — read/unread/archive, grouping, and
 * per-category preferences. Notifications are always personal to a user, so the
 * "scope" is simply ownership.
 */

/** Categories a user can toggle. Derived from a notification `type`'s prefix. */
export const NOTIFICATION_CATEGORIES = [
  "task", "approval", "discussion", "case", "design", "registration",
  "subscription", "attendance", "daily_check", "whatsapp", "publishing",
  "answer", "knowledge", "campaign", "file", "system",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export function categoryOf(type: string): NotificationCategory {
  const head = type.split(".")[0];
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(head) ? (head as NotificationCategory) : "system";
}

/** Resolve a click-through link for a notification from its entity. */
export function notificationHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  const map: Record<string, string> = {
    Task: "/tasks", CustomerCase: "/cases", ApprovalRequest: "/approvals", DesignRequest: "/design",
    RegistrationCase: "/registrations", Subscription: "/subscriptions", Campaign: "/campaigns",
    PublishingItem: "/social", WhatsappCampaign: "/whatsapp", ApprovedAnswer: "/answers",
    KnowledgeArticle: "/knowledge", File: "/files", Channel: "/discussions",
    AttendanceCorrection: "/attendance", ChecklistInstance: "/daily-checks",
  };
  const base = map[entityType];
  if (!base) return null;
  // Channel/attendance land on the section (id-less) route; the rest on the record.
  if (entityType === "AttendanceCorrection") return base;
  return `${base}/${entityId}`;
}

export interface NotificationGroup {
  key: string;
  latest: Notification;
  count: number;
  ids: string[];
  href: string | null;
  category: NotificationCategory;
  unread: boolean;
}

/** The current user's notifications, grouped and with resolved links. */
export async function listNotifications(principal: Principal, opts: { onlyUnread?: boolean; category?: string; take?: number } = {}) {
  const rows = await prisma.notification.findMany({
    where: {
      userId: principal.userId, state: { not: "archived" },
      ...(opts.onlyUnread ? { state: "unread" } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 200,
  });
  const filtered = opts.category ? rows.filter((n) => categoryOf(n.type) === opts.category) : rows;

  // Group by groupKey (falls back to per-notification id when absent).
  const byKey = new Map<string, NotificationGroup>();
  const order: string[] = [];
  for (const n of filtered) {
    const key = n.groupKey ?? n.id;
    let g = byKey.get(key);
    if (!g) {
      g = { key, latest: n, count: 0, ids: [], href: notificationHref(n.entityType, n.entityId), category: categoryOf(n.type), unread: false };
      byKey.set(key, g);
      order.push(key);
    }
    g.count++;
    g.ids.push(n.id);
    if (n.state === "unread") g.unread = true;
  }
  return {
    groups: order.map((k) => byKey.get(k)!),
    unread: rows.filter((n) => n.state === "unread").length,
  };
}

/** Unread count only (for the nav badge). */
export async function unreadCount(principal: Principal): Promise<number> {
  return prisma.notification.count({ where: { userId: principal.userId, state: "unread" } });
}

async function ownNotification(ctx: ActorContext, id: string): Promise<Notification> {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== ctx.principal.userId) throw new ServiceError("not_found", "Notification not found", 404);
  return n;
}

export async function markRead(ctx: ActorContext, ids: string[], read = true): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: { in: ids }, userId: ctx.principal.userId },
    data: read ? { state: "read", readAt: new Date() } : { state: "unread", readAt: null },
  });
}

export async function archiveNotifications(ctx: ActorContext, ids: string[]): Promise<void> {
  await prisma.notification.updateMany({ where: { id: { in: ids }, userId: ctx.principal.userId }, data: { state: "archived" } });
}

export async function markAllRead(ctx: ActorContext): Promise<void> {
  await prisma.notification.updateMany({ where: { userId: ctx.principal.userId, state: "unread" }, data: { state: "read", readAt: new Date() } });
}

// --- Preferences ----------------------------------------------------------

export async function getPreferences(principal: Principal): Promise<Record<string, { inapp: boolean; email: boolean }>> {
  const prefs = await prisma.notificationPreference.findMany({ where: { userId: principal.userId } });
  const map: Record<string, { inapp: boolean; email: boolean }> = {};
  for (const c of NOTIFICATION_CATEGORIES) map[c] = { inapp: true, email: false };
  for (const p of prefs) {
    if (!map[p.category]) map[p.category] = { inapp: true, email: false };
    if (p.channel === "inapp") map[p.category].inapp = p.enabled;
    if (p.channel === "email") map[p.category].email = p.enabled;
  }
  return map;
}

export async function setPreference(ctx: ActorContext, category: string, channel: "inapp" | "email", enabled: boolean): Promise<void> {
  if (!(NOTIFICATION_CATEGORIES as readonly string[]).includes(category)) throw new ServiceError("bad_category", "Unknown category", 400);
  await prisma.notificationPreference.upsert({
    where: { userId_category_channel: { userId: ctx.principal.userId, category, channel } },
    create: { userId: ctx.principal.userId, category, channel, enabled },
    update: { enabled },
  });
}

/**
 * Filter a set of recipients to those who have NOT disabled the in-app channel
 * for this category. Used by notify() so preferences actually suppress noise.
 */
export async function recipientsAllowing(userIds: string[], type: string): Promise<string[]> {
  if (userIds.length === 0) return [];
  const category = categoryOf(type);
  const disabled = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds }, category, channel: "inapp", enabled: false },
    select: { userId: true },
  });
  const off = new Set(disabled.map((d) => d.userId));
  return userIds.filter((id) => !off.has(id));
}
