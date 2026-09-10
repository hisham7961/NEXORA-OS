import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { seal, open } from "@/lib/auth/secretbox";
import { logger } from "@/lib/log";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";

/**
 * Outbound webhooks (§36). Integrations subscribe a URL to a set of event types;
 * when an event fires we enqueue a signed delivery and POST it, retrying with
 * exponential backoff up to maxAttempts before dead-lettering. Each request carries
 * an HMAC signature (X-Nexora-Signature) so the receiver can verify authenticity
 * with the shared secret shown once at creation. Delivery is decoupled from the
 * triggering request: emit enqueues, and both an immediate best-effort attempt and a
 * scheduled job drain the queue, so a slow/down receiver never blocks app work.
 */
const log = logger.child({ component: "webhooks" });
const DELIVERY_TIMEOUT_MS = 10_000;
const BASE_BACKOFF_MS = 60_000;

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

// Cache of subscribed event names so emit() can skip a DB hit when nothing listens.
let subCache: { at: number; all: boolean; events: Set<string> } | null = null;
const SUB_TTL_MS = 30_000;
async function subscribedEvents(): Promise<{ all: boolean; events: Set<string> }> {
  if (subCache && Date.now() - subCache.at < SUB_TTL_MS) return subCache;
  const hooks = await prisma.webhook.findMany({ where: { active: true }, select: { eventsJson: true } });
  const events = new Set<string>();
  let all = false;
  for (const h of hooks) {
    try { for (const e of JSON.parse(h.eventsJson) as string[]) { if (e === "*") all = true; else events.add(e); } } catch { /* skip */ }
  }
  subCache = { at: Date.now(), all, events };
  return subCache;
}
export function invalidateWebhookCache() { subCache = null; }

// --- Lifecycle ---------------------------------------------------------------

export const webhookSchema = z.object({
  name: z.string().trim().min(1).max(80),
  url: z.string().url().refine((u) => u.startsWith("https://") || u.startsWith("http://"), "Must be an http(s) URL"),
  events: z.array(z.string().trim().min(1)).min(1),
});

export async function listWebhooks(principal: Principal) {
  assertCan(principal, "settings.view");
  const rows = await prisma.webhook.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, url: true, eventsJson: true, active: true, createdAt: true } });
  return rows.map((w) => ({ id: w.id, name: w.name, url: w.url, events: safeEvents(w.eventsJson), active: w.active, createdAt: w.createdAt }));
}
function safeEvents(json: string): string[] { try { return JSON.parse(json) as string[]; } catch { return []; } }

export async function createWebhook(ctx: ActorContext, raw: unknown): Promise<{ id: string; secret: string }> {
  assertCan(ctx.principal, "settings.manage");
  const input = webhookSchema.parse(raw);
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const row = await prisma.webhook.create({
    data: { name: input.name, url: input.url, secret: seal(secret), eventsJson: JSON.stringify(input.events), createdById: ctx.principal.userId },
  });
  invalidateWebhookCache();
  await audit(ctx, { action: "webhook.created", entityType: "Webhook", entityId: row.id, summary: `Created webhook "${input.name}" → ${input.url}` });
  return { id: row.id, secret };
}

export async function setWebhookActive(ctx: ActorContext, id: string, active: boolean): Promise<void> {
  assertCan(ctx.principal, "settings.manage");
  const w = await prisma.webhook.findUnique({ where: { id } });
  if (!w) throw new ServiceError("not_found", "Webhook not found", 404);
  await prisma.webhook.update({ where: { id }, data: { active } });
  invalidateWebhookCache();
  await audit(ctx, { action: "webhook.updated", entityType: "Webhook", entityId: id, summary: `${active ? "Enabled" : "Disabled"} webhook "${w.name}"` });
}

export async function deleteWebhook(ctx: ActorContext, id: string): Promise<void> {
  assertCan(ctx.principal, "settings.manage");
  const w = await prisma.webhook.findUnique({ where: { id } });
  if (!w) throw new ServiceError("not_found", "Webhook not found", 404);
  await prisma.webhook.delete({ where: { id } });
  invalidateWebhookCache();
  await audit(ctx, { action: "webhook.deleted", entityType: "Webhook", entityId: id, summary: `Deleted webhook "${w.name}"` });
}

export async function recentDeliveries(id: string, take = 20) {
  return prisma.webhookDelivery.findMany({ where: { webhookId: id }, orderBy: { createdAt: "desc" }, take, select: { id: true, event: true, status: true, attempts: true, responseStatus: true, error: true, createdAt: true, lastAttemptAt: true } });
}

// --- Emit + deliver ----------------------------------------------------------

/**
 * Fire an event to every active webhook subscribed to it. Cheap when nothing
 * listens (a cached subscription set is consulted first). Never throws into the
 * caller — a webhook problem must not break the business action that emitted it.
 */
export async function emitWebhookEvent(event: string, data: Record<string, unknown>): Promise<void> {
  try {
    const sub = await subscribedEvents();
    if (!sub.all && !sub.events.has(event)) return;
    const hooks = await prisma.webhook.findMany({ where: { active: true } });
    const targets = hooks.filter((h) => { const evts = safeEvents(h.eventsJson); return evts.includes("*") || evts.includes(event); });
    if (targets.length === 0) return;
    const payload = JSON.stringify({ event, at: new Date().toISOString(), data });
    const created = await prisma.$transaction(targets.map((h) => prisma.webhookDelivery.create({ data: { webhookId: h.id, event, payloadJson: payload } })));
    // Best-effort immediate attempt; the scheduled job retries any that fail.
    void Promise.all(created.map((d) => attemptDelivery(d.id))).catch(() => {});
  } catch (e) {
    log.warn("emit failed", { event, err: e });
  }
}

async function attemptDelivery(deliveryId: string): Promise<void> {
  const d = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { webhook: true } });
  if (!d || d.status === "success") return;
  if (!d.webhook || !d.webhook.active) { await prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: "failed", error: "webhook inactive/removed" } }).catch(() => {}); return; }

  const secret = open(d.webhook.secret);
  const attempts = d.attempts + 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const res = await fetch(d.webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "NEXORA-Webhooks/1",
        "X-Nexora-Event": d.event,
        "X-Nexora-Delivery": d.id,
        "X-Nexora-Signature": secret ? `sha256=${sign(secret, d.payloadJson)}` : "",
      },
      body: d.payloadJson,
      signal: controller.signal,
    });
    if (res.ok) {
      await prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: "success", attempts, responseStatus: res.status, lastAttemptAt: new Date(), error: null } });
    } else {
      await scheduleRetry(d.id, attempts, d.maxAttempts, `HTTP ${res.status}`, res.status);
    }
  } catch (e) {
    await scheduleRetry(d.id, attempts, d.maxAttempts, e instanceof Error ? e.message : "delivery error", null);
  } finally {
    clearTimeout(timer);
  }
}

async function scheduleRetry(id: string, attempts: number, maxAttempts: number, error: string, responseStatus: number | null): Promise<void> {
  if (attempts >= maxAttempts) {
    await prisma.webhookDelivery.update({ where: { id }, data: { status: "failed", attempts, responseStatus, error, lastAttemptAt: new Date() } }).catch(() => {});
    log.warn("delivery dead-lettered", { deliveryId: id, attempts, error });
    return;
  }
  const delay = BASE_BACKOFF_MS * 2 ** (attempts - 1); // 1, 2, 4, 8 min…
  await prisma.webhookDelivery.update({
    where: { id },
    data: { status: "pending", attempts, responseStatus, error, lastAttemptAt: new Date(), nextAttemptAt: new Date(Date.now() + delay) },
  }).catch(() => {});
}

/** Drain due pending deliveries — called by the scheduled Webhook delivery job. */
export async function deliverPendingWebhooks(limit = 100): Promise<{ attempted: number }> {
  const due = await prisma.webhookDelivery.findMany({
    where: { status: "pending", nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" }, take: limit, select: { id: true },
  });
  for (const d of due) await attemptDelivery(d.id);
  return { attempted: due.length };
}
