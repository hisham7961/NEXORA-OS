import { z } from "zod";
import type { Channel, Message } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canAnywhere, assertRecordInScope, ForbiddenError, type Principal } from "@/lib/permissions/engine";
import { scopedWhere } from "@/domain/scope";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, notify, type ActorContext } from "@/domain/mutation";
import { optionalString } from "@/lib/validation";

// ---------------------------------------------------------------------------
// INTERNAL DISCUSSIONS (§9–12) — structured work communication, not a chat
// clone. Channels are scoped and/or entity-linked; access is by membership plus
// scope. Messages carry a kind (announcement/decision/action_required), support
// threads (parentId), mentions, reactions and pins, and can be converted into
// real work (Task/Case/Approval/Design Request) via the existing services.
// ---------------------------------------------------------------------------

const DIMS_CBC = ["companyId", "brandId", "countryId"] as const;
export const MESSAGE_KINDS = ["message", "announcement", "decision", "action_required"] as const;
const CHANNEL_TYPES = ["general", "brand", "company", "department", "campaign", "product", "project", "registration", "store"] as const;

function channelScope(c: { companyId: string | null; brandId: string | null; countryId: string | null }) {
  return { companyId: c.companyId, brandId: c.brandId, countryId: c.countryId };
}

/** Whether the principal may access a channel: a member always; otherwise a
 *  public channel within their discussions.view scope. Private channels require
 *  membership. */
async function canAccessChannel(principal: Principal, channel: Channel): Promise<boolean> {
  const membership = await prisma.channelMember.findUnique({ where: { channelId_userId: { channelId: channel.id, userId: principal.userId } } });
  if (membership) return true;
  if (channel.isPrivate) return false;
  try {
    assertRecordInScope(principal, "discussions.view", channelScope(channel), [...DIMS_CBC]);
    return true;
  } catch {
    return false;
  }
}

/** Channels the caller can see (member of, or public in scope), newest activity first. */
export async function listChannels(principal: Principal): Promise<(Channel & { unread: number })[]> {
  const memberIds = (await prisma.channelMember.findMany({ where: { userId: principal.userId }, select: { channelId: true } })).map((m) => m.channelId);
  const publicWhere = canAnywhere(principal, "discussions.view")
    ? { archivedAt: null, isPrivate: false, ...scopedWhere(principal, "discussions.view", [...DIMS_CBC], {}) }
    : { id: { in: [] as string[] } };
  const channels = await prisma.channel.findMany({
    where: { archivedAt: null, OR: [{ id: { in: memberIds } }, publicWhere] },
    orderBy: [{ lastMessageAt: "desc" }, { name: "asc" }],
  });
  // Unread counts for member channels.
  const members = await prisma.channelMember.findMany({ where: { userId: principal.userId, channelId: { in: channels.map((c) => c.id) } } });
  const lastReadByChannel = new Map(members.map((m) => [m.channelId, m.lastReadAt]));
  const result = await Promise.all(channels.map(async (c) => {
    const since = lastReadByChannel.get(c.id);
    const unread = lastReadByChannel.has(c.id)
      ? await prisma.message.count({ where: { channelId: c.id, archivedAt: null, authorId: { not: principal.userId }, ...(since ? { createdAt: { gt: since } } : {}) } })
      : 0;
    return { ...c, unread };
  }));
  return result;
}

export async function getChannel(principal: Principal, id: string) {
  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel || channel.archivedAt) return null;
  if (!(await canAccessChannel(principal, channel))) throw new ForbiddenError("discussions.view");
  return channel;
}

export interface MessageView {
  id: string;
  authorId: string;
  body: string;
  kind: string;
  isPinned: boolean;
  editedAt: Date | null;
  createdAt: Date;
  parentId: string | null;
  replyCount: number;
  mentions: string[];
  reactions: { emoji: string; count: number; mine: boolean }[];
}

/** Top-level messages for a channel (thread roots), paginated by cursor (before). */
export async function listMessages(principal: Principal, channelId: string, opts: { before?: string; limit?: number } = {}): Promise<MessageView[]> {
  const channel = await getChannel(principal, channelId);
  if (!channel) throw new ServiceError("not_found", "Channel not found", 404);
  const limit = Math.min(opts.limit ?? 40, 100);
  const cursor = opts.before ? await prisma.message.findUnique({ where: { id: opts.before }, select: { createdAt: true } }) : null;
  const rows = await prisma.message.findMany({
    where: { channelId, parentId: null, archivedAt: null, ...(cursor ? { createdAt: { lt: cursor.createdAt } } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { mentions: true },
  });
  return hydrateMessages(principal, rows.reverse());
}

/** Replies within a thread. */
export async function listThread(principal: Principal, channelId: string, parentId: string): Promise<MessageView[]> {
  const channel = await getChannel(principal, channelId);
  if (!channel) throw new ServiceError("not_found", "Channel not found", 404);
  const rows = await prisma.message.findMany({ where: { channelId, parentId, archivedAt: null }, orderBy: { createdAt: "asc" }, include: { mentions: true } });
  return hydrateMessages(principal, rows);
}

async function hydrateMessages(principal: Principal, rows: (Message & { mentions: { userId: string }[] })[]): Promise<MessageView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [replyCounts, reactions] = await Promise.all([
    prisma.message.groupBy({ by: ["parentId"], where: { parentId: { in: ids }, archivedAt: null }, _count: true }),
    prisma.reaction.findMany({ where: { entityType: "Message", entityId: { in: ids } } }),
  ]);
  const replyByParent = new Map(replyCounts.map((r) => [r.parentId, r._count]));
  const reactionsByMsg = new Map<string, { emoji: string; count: number; mine: boolean }[]>();
  for (const r of reactions) {
    const list = reactionsByMsg.get(r.entityId) ?? [];
    const existing = list.find((x) => x.emoji === r.emoji);
    if (existing) { existing.count++; if (r.userId === principal.userId) existing.mine = true; }
    else list.push({ emoji: r.emoji, count: 1, mine: r.userId === principal.userId });
    reactionsByMsg.set(r.entityId, list);
  }
  return rows.map((r) => ({
    id: r.id, authorId: r.authorId, body: r.body, kind: r.kind, isPinned: r.isPinned,
    editedAt: r.editedAt, createdAt: r.createdAt, parentId: r.parentId,
    replyCount: replyByParent.get(r.id) ?? 0,
    mentions: r.mentions.map((m) => m.userId),
    reactions: reactionsByMsg.get(r.id) ?? [],
  }));
}

export async function listPinned(principal: Principal, channelId: string): Promise<MessageView[]> {
  const channel = await getChannel(principal, channelId);
  if (!channel) throw new ServiceError("not_found", "Channel not found", 404);
  const rows = await prisma.message.findMany({ where: { channelId, isPinned: true, archivedAt: null }, orderBy: { createdAt: "desc" }, include: { mentions: true } });
  return hydrateMessages(principal, rows);
}

// --- Writes ---------------------------------------------------------------

export const channelSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: optionalString,
  type: z.enum(CHANNEL_TYPES).default("general"),
  companyId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  departmentId: optionalString,
  entityType: optionalString,
  entityId: optionalString,
  isPrivate: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
  memberIds: z.array(z.string()).optional(),
});

export async function createChannel(ctx: ActorContext, raw: unknown): Promise<Channel> {
  const input = channelSchema.parse(raw);
  assertCan(ctx.principal, "discussions.create", { companyId: input.companyId ?? null, brandId: input.brandId ?? null, countryId: input.countryId ?? null });
  const channel = await prisma.$transaction(async (tx) => {
    const c = await tx.channel.create({
      data: {
        name: input.name, description: input.description ?? null, type: input.type,
        companyId: input.companyId ?? null, brandId: input.brandId ?? null, countryId: input.countryId ?? null,
        departmentId: input.departmentId ?? null, entityType: input.entityType ?? null, entityId: input.entityId ?? null,
        isPrivate: input.isPrivate,
      },
    });
    const members = new Set([ctx.principal.userId, ...(input.memberIds ?? [])]);
    await tx.channelMember.createMany({ data: [...members].map((userId) => ({ channelId: c.id, userId, role: userId === ctx.principal.userId ? "owner" : "member", lastReadAt: new Date() })) });
    return c;
  });
  await audit(ctx, { action: "channel.created", entityType: "Channel", entityId: channel.id, summary: input.name, brandId: channel.brandId, companyId: channel.companyId });
  return channel;
}

/** Ensure a channel exists for an entity (campaign/product/…) and return it. */
export async function ensureEntityChannel(ctx: ActorContext, entityType: string, entityId: string, name: string, scope: { companyId?: string | null; brandId?: string | null; countryId?: string | null }): Promise<Channel> {
  const existing = await prisma.channel.findFirst({ where: { entityType, entityId, archivedAt: null } });
  if (existing) return existing;
  return createChannel(ctx, { name, type: entityTypeToChannelType(entityType), entityType, entityId, ...scope });
}

function entityTypeToChannelType(t: string): string {
  const m: Record<string, string> = { Campaign: "campaign", Product: "product", Project: "project", Store: "store", RegistrationCase: "registration" };
  return m[t] ?? "general";
}

export async function joinChannel(ctx: ActorContext, channelId: string): Promise<void> {
  const channel = await getChannel(ctx.principal, channelId);
  if (!channel) throw new ServiceError("not_found", "Channel not found", 404);
  await prisma.channelMember.upsert({
    where: { channelId_userId: { channelId, userId: ctx.principal.userId } },
    create: { channelId, userId: ctx.principal.userId, lastReadAt: new Date() },
    update: {},
  });
}

const MENTION_RE = /@([a-zA-Z0-9._-]+)/g;

export const postMessageSchema = z.object({
  body: z.string().trim().min(1).max(8000),
  kind: z.enum(MESSAGE_KINDS).default("message"),
  parentId: optionalString,
});

export async function postMessage(ctx: ActorContext, channelId: string, raw: unknown): Promise<Message> {
  const channel = await getChannel(ctx.principal, channelId);
  if (!channel) throw new ServiceError("not_found", "Channel not found", 404);
  const input = postMessageSchema.parse(raw);
  // Only members may post; auto-join public channels on first post.
  await joinChannel(ctx, channelId);

  // Resolve @mentions to user ids (by email local-part or name token).
  const handles = [...input.body.matchAll(MENTION_RE)].map((m) => m[1].toLowerCase());
  const mentionedUserIds = handles.length ? await resolveMentions(handles) : [];

  const message = await prisma.$transaction(async (tx) => {
    const m = await tx.message.create({ data: { channelId, authorId: ctx.principal.userId, body: input.body, kind: input.kind, parentId: input.parentId ?? null } });
    if (mentionedUserIds.length) await tx.messageMention.createMany({ data: mentionedUserIds.map((userId) => ({ messageId: m.id, userId })), skipDuplicates: true });
    await tx.channel.update({ where: { id: channelId }, data: { lastMessageAt: new Date() } });
    await tx.channelMember.update({ where: { channelId_userId: { channelId, userId: ctx.principal.userId } }, data: { lastReadAt: new Date() } });
    return m;
  });
  await notify(mentionedUserIds, { type: "discussion.mention", title: `You were mentioned in #${channel.name}`, body: input.body.slice(0, 140), entityType: "Channel", entityId: channelId }, ctx.principal.userId);
  if (input.kind === "action_required" || input.kind === "decision") {
    await audit(ctx, { action: `message.${input.kind}`, entityType: "Channel", entityId: channelId, summary: input.body.slice(0, 120), brandId: channel.brandId, companyId: channel.companyId });
  }
  return message;
}

async function resolveMentions(handles: string[]): Promise<string[]> {
  const users = await prisma.user.findMany({ where: { archivedAt: null, status: "active" }, select: { id: true, email: true, name: true } });
  const ids = new Set<string>();
  for (const h of handles) {
    const u = users.find((u) => u.email.split("@")[0].toLowerCase() === h || u.name.toLowerCase().replace(/\s+/g, "") === h || u.name.toLowerCase().split(/\s+/)[0] === h);
    if (u) ids.add(u.id);
  }
  return [...ids];
}

async function loadOwnMessage(ctx: ActorContext, messageId: string): Promise<Message & { channel: Channel }> {
  const message = await prisma.message.findUnique({ where: { id: messageId }, include: { channel: true } });
  if (!message || message.archivedAt) throw new ServiceError("not_found", "Message not found", 404);
  if (!(await canAccessChannel(ctx.principal, message.channel))) throw new ForbiddenError("discussions.view");
  return message;
}

export async function editMessage(ctx: ActorContext, messageId: string, body: string): Promise<Message> {
  const message = await loadOwnMessage(ctx, messageId);
  if (message.authorId !== ctx.principal.userId) throw new ForbiddenError("discussions.edit_own");
  if (!body.trim()) throw new ServiceError("empty", "Message cannot be empty", 422);
  const updated = await prisma.message.update({ where: { id: messageId }, data: { body: body.trim(), editedAt: new Date() } });
  await audit(ctx, { action: "message.edited", entityType: "Channel", entityId: message.channelId, summary: body.trim().slice(0, 100), brandId: message.channel.brandId });
  return updated;
}

export async function deleteMessage(ctx: ActorContext, messageId: string): Promise<void> {
  const message = await loadOwnMessage(ctx, messageId);
  const isManager = canAnywhere(ctx.principal, "discussions.manage");
  if (message.authorId !== ctx.principal.userId && !isManager) throw new ForbiddenError("discussions.edit_own");
  await prisma.message.update({ where: { id: messageId }, data: { archivedAt: new Date() } });
  await audit(ctx, { action: "message.deleted", entityType: "Channel", entityId: message.channelId, summary: message.body.slice(0, 100), brandId: message.channel.brandId });
}

export async function setMessagePinned(ctx: ActorContext, messageId: string, pinned: boolean): Promise<void> {
  const message = await loadOwnMessage(ctx, messageId);
  await prisma.message.update({ where: { id: messageId }, data: { isPinned: pinned } });
  await audit(ctx, { action: pinned ? "message.pinned" : "message.unpinned", entityType: "Channel", entityId: message.channelId, summary: message.body.slice(0, 100), brandId: message.channel.brandId });
}

export async function toggleReaction(ctx: ActorContext, messageId: string, emoji: string): Promise<void> {
  const message = await loadOwnMessage(ctx, messageId);
  const key = { entityType_entityId_userId_emoji: { entityType: "Message", entityId: message.id, userId: ctx.principal.userId, emoji } };
  const existing = await prisma.reaction.findUnique({ where: key });
  if (existing) await prisma.reaction.delete({ where: key });
  else await prisma.reaction.create({ data: { entityType: "Message", entityId: message.id, userId: ctx.principal.userId, emoji } });
}

export async function markChannelRead(ctx: ActorContext, channelId: string): Promise<void> {
  await prisma.channelMember.updateMany({ where: { channelId, userId: ctx.principal.userId }, data: { lastReadAt: new Date() } });
}

/** Search messages the caller can see. */
export async function searchMessages(principal: Principal, q: string, limit = 30): Promise<(MessageView & { channelId: string; channelName: string })[]> {
  if (!q.trim()) return [];
  const channels = await listChannels(principal);
  const channelIds = channels.map((c) => c.id);
  if (channelIds.length === 0) return [];
  const rows = await prisma.message.findMany({
    where: { channelId: { in: channelIds }, archivedAt: null, body: { contains: q, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { mentions: true },
  });
  const hydrated = await hydrateMessages(principal, rows);
  const nameById = new Map(channels.map((c) => [c.id, c.name]));
  return hydrated.map((m, i) => ({ ...m, channelId: rows[i].channelId, channelName: nameById.get(rows[i].channelId) ?? "" }));
}

// --- Convert a message into real work (§12) ------------------------------
// Uses the SAME domain services as the rest of the app — no duplicated logic —
// and posts a backlink reply so the thread and the created entity stay linked.

import { createTask } from "@/domain/tasks";
import { createCase } from "@/domain/cases";
import { createApprovalRequest } from "@/domain/approvals";
import { createDesignRequest } from "@/domain/design";

export type ConvertTarget = "task" | "case" | "approval" | "design";

async function backlink(ctx: ActorContext, channelId: string, parentMessageId: string, label: string, href: string): Promise<void> {
  await prisma.message.create({ data: { channelId, authorId: ctx.principal.userId, body: `🔗 Created ${label} from this thread → ${href}`, kind: "message", parentId: parentMessageId } });
  await prisma.channel.update({ where: { id: channelId }, data: { lastMessageAt: new Date() } }).catch(() => {});
}

/**
 * Convert a message into a Task/Case/Approval/Design Request. Extra fields
 * (title, assignees/approvers) come from the caller. The created entity flows
 * through normal module workflows; a backlink reply ties it to the thread.
 */
export async function convertMessage(
  ctx: ActorContext,
  messageId: string,
  target: ConvertTarget,
  extra: { title?: string; assigneeIds?: string[]; approverIds?: string[]; ownerId?: string } = {},
): Promise<{ type: ConvertTarget; id: string; href: string }> {
  const message = await loadOwnMessage(ctx, messageId);
  const ch = message.channel;
  // The create services validate with optionalString (string | undefined), so
  // null scope columns must be dropped, not passed through as null.
  const scope: Record<string, string> = {};
  if (ch.companyId) scope.companyId = ch.companyId;
  if (ch.brandId) scope.brandId = ch.brandId;
  if (ch.countryId) scope.countryId = ch.countryId;
  const title = (extra.title?.trim() || message.body.split("\n")[0]).slice(0, 180);
  const context = `From discussion #${ch.name}:\n\n${message.body}`;

  let id: string, href: string, label: string;
  switch (target) {
    case "task": {
      const t = await createTask(ctx, { title, description: context, ...scope, ownerId: extra.ownerId, assigneeIds: extra.assigneeIds ?? [] });
      id = t.id; href = `/tasks/${t.id}`; label = "task";
      break;
    }
    case "case": {
      const c = await createCase(ctx, { type: "other", description: context, ...scope, assignedToId: extra.ownerId });
      id = c.id; href = `/cases/${c.id}`; label = "customer case";
      break;
    }
    case "approval": {
      if (!extra.approverIds?.length) throw new ServiceError("approver_required", "Select at least one approver.", 422);
      const a = await createApprovalRequest(ctx, { title, type: "discussion", entityType: "Channel", entityId: ch.id, companyId: scope.companyId, brandId: scope.brandId, notes: context, approverIds: extra.approverIds });
      id = a.id; href = `/approvals/${a.id}`; label = "approval request";
      break;
    }
    case "design": {
      const d = await createDesignRequest(ctx, { assetType: "other", copy: context, ...scope, designerId: extra.ownerId });
      id = d.id; href = `/design/${d.id}`; label = "design request";
      break;
    }
    default:
      throw new ServiceError("bad_target", "Unknown conversion target", 400);
  }
  await backlink(ctx, ch.id, message.parentId ?? message.id, label, href);
  await audit(ctx, { action: "message.converted", entityType: "Channel", entityId: ch.id, summary: `→ ${label}: ${title}`, brandId: ch.brandId, companyId: ch.companyId });
  return { type: target, id, href };
}

export { canAccessChannel };
