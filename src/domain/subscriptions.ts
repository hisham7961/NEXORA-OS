import { z } from "zod";
import type { Subscription } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, notify, type ActorContext } from "@/domain/mutation";
import { optionalString, optionalNumber, optionalDate } from "@/lib/validation";

/** Subscriptions & services (§25). `filter=renewing` = due within 30 days. */
export const subscriptionQuerySchema = listQuerySchema.extend({ status: z.string().optional(), filter: z.string().optional() });
export type SubscriptionQuery = z.infer<typeof subscriptionQuerySchema>;

export async function listSubscriptions(principal: Principal, query: SubscriptionQuery): Promise<{ rows: Subscription[]; total: number }> {
  const in30 = new Date(Date.now() + 30 * 86_400_000);
  const extra: Record<string, unknown> = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { OR: [{ provider: { contains: query.q, mode: "insensitive" } }] } : {}),
    ...(query.filter === "renewing" ? { renewalDate: { lte: in30 }, status: { not: "cancelled" } } : {}),
  };
  const where: Record<string, unknown> = { archivedAt: null, ...scopedWhere(principal, "subscriptions.view", DIMS_CBC, extra) };
  const [rows, total] = await Promise.all([
    prisma.subscription.findMany({ where, orderBy: { renewalDate: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.subscription.count({ where }),
  ]);
  return { rows, total };
}

/** Detail for one subscription, fail-closed on scope. */
export async function getSubscription(principal: Principal, id: string) {
  const s = await prisma.subscription.findUnique({ where: { id } });
  if (!s || s.archivedAt) return null;
  assertRecordInScope(principal, "subscriptions.view", { companyId: s.companyId, brandId: s.brandId, countryId: s.countryId }, DIMS_CBC);
  return s;
}

// ---------------------------------------------------------------------------
// WRITE PATHS (§23) — create/edit/assign/renew/cancel/archive. No passwords are
// ever stored (only a paymentMethodRef string).
// ---------------------------------------------------------------------------

const BILLING_CYCLES = ["monthly", "quarterly", "yearly", "custom"] as const;

export const subscriptionInputSchema = z.object({
  provider: z.string().trim().min(1).max(120),
  plan: optionalString,
  companyId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  ownerId: optionalString,
  currency: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : undefined), z.string().min(1).max(8).default("USD")),
  cost: optionalNumber,
  billingCycle: z.enum(BILLING_CYCLES).default("monthly"),
  renewalDate: optionalDate,
  autoRenew: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(true),
  paymentMethodRef: optionalString,
  licenses: optionalNumber,
  notes: optionalString,
});

function subScope(s: { companyId: string | null; brandId: string | null; countryId: string | null }) {
  return { companyId: s.companyId, brandId: s.brandId, countryId: s.countryId };
}

export async function createSubscription(ctx: ActorContext, raw: unknown): Promise<Subscription> {
  const input = subscriptionInputSchema.parse(raw);
  const scope = { companyId: input.companyId ?? null, brandId: input.brandId ?? null, countryId: input.countryId ?? null };
  assertCan(ctx.principal, "subscriptions.create", scope);
  const s = await prisma.subscription.create({
    data: {
      provider: input.provider, plan: input.plan ?? null, ...scope, ownerId: input.ownerId ?? null,
      currency: input.currency, cost: input.cost ?? null, billingCycle: input.billingCycle,
      renewalDate: input.renewalDate ?? null, autoRenew: input.autoRenew, paymentMethodRef: input.paymentMethodRef ?? null,
      licenses: input.licenses != null ? Math.trunc(input.licenses) : null, notes: input.notes ?? null, status: "active",
    },
  });
  await audit(ctx, { action: "subscription.created", entityType: "Subscription", entityId: s.id, summary: input.provider, brandId: s.brandId, companyId: s.companyId });
  await notify([input.ownerId], { type: "subscription.assigned", title: "You own a subscription", body: input.provider, entityType: "Subscription", entityId: s.id }, ctx.principal.userId);
  return s;
}

async function loadEditableSub(ctx: ActorContext, id: string): Promise<Subscription> {
  const s = await prisma.subscription.findUnique({ where: { id } });
  if (!s || s.archivedAt) throw new ServiceError("not_found", "Subscription not found", 404);
  assertRecordInScope(ctx.principal, "subscriptions.edit", subScope(s), DIMS_CBC);
  return s;
}

export async function updateSubscription(ctx: ActorContext, id: string, raw: unknown): Promise<Subscription> {
  const existing = await loadEditableSub(ctx, id);
  const input = subscriptionInputSchema.partial().parse(raw);
  const data: Record<string, unknown> = {};
  for (const k of ["provider", "plan", "ownerId", "currency", "cost", "billingCycle", "autoRenew", "paymentMethodRef", "licenses", "notes"] as const) {
    if (input[k] !== undefined) data[k] = k === "licenses" && input.licenses != null ? Math.trunc(input.licenses) : input[k];
  }
  // Changing the renewal date resets the reminder ledger for the new date.
  if (input.renewalDate !== undefined && input.renewalDate?.getTime() !== existing.renewalDate?.getTime()) {
    data.renewalDate = input.renewalDate ?? null;
    data.remindersSentJson = null;
  }
  const updated = await prisma.subscription.update({ where: { id }, data });
  await audit(ctx, { action: "subscription.updated", entityType: "Subscription", entityId: id, summary: "updated", brandId: existing.brandId, companyId: existing.companyId, newValues: data });
  if (input.ownerId && input.ownerId !== existing.ownerId) {
    await notify([input.ownerId], { type: "subscription.assigned", title: "You own a subscription", body: existing.provider, entityType: "Subscription", entityId: id }, ctx.principal.userId);
  }
  return updated;
}

/** Advance the renewal date by the billing cycle and clear the reminder ledger. */
export async function renewSubscription(ctx: ActorContext, id: string, nextDate?: Date): Promise<Subscription> {
  const existing = await loadEditableSub(ctx, id);
  const base = nextDate ?? nextRenewal(existing.renewalDate ?? new Date(), existing.billingCycle);
  const updated = await prisma.subscription.update({ where: { id }, data: { renewalDate: base, status: "active", remindersSentJson: null } });
  await audit(ctx, { action: "subscription.renewed", entityType: "Subscription", entityId: id, summary: `→ ${base.toISOString().slice(0, 10)}`, brandId: existing.brandId, companyId: existing.companyId });
  return updated;
}

function nextRenewal(from: Date, cycle: string): Date {
  const d = new Date(from);
  if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  else if (cycle === "quarterly") d.setMonth(d.getMonth() + 3);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export async function cancelSubscription(ctx: ActorContext, id: string): Promise<Subscription> {
  const existing = await loadEditableSub(ctx, id);
  const updated = await prisma.subscription.update({ where: { id }, data: { status: "cancelled", autoRenew: false } });
  await audit(ctx, { action: "subscription.cancelled", entityType: "Subscription", entityId: id, summary: existing.provider, brandId: existing.brandId, companyId: existing.companyId });
  return updated;
}

export async function archiveSubscription(ctx: ActorContext, id: string): Promise<void> {
  const existing = await loadEditableSub(ctx, id);
  await prisma.subscription.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit(ctx, { action: "subscription.archived", entityType: "Subscription", entityId: id, summary: existing.provider, brandId: existing.brandId, companyId: existing.companyId });
}

// ---------------------------------------------------------------------------
// RENEWAL REMINDER JOB (§24) — idempotent, retryable, visible in System Jobs.
// ---------------------------------------------------------------------------

/** Default reminder thresholds (days before renewal). Admin-configurable via payload. */
export const DEFAULT_REMINDER_DAYS = [90, 60, 30, 14, 7, 1];
const REMINDER_JOB = "subscription-reminders";

function parseSent(json: string | null): number[] {
  if (!json) return [];
  try { const v = JSON.parse(json); return Array.isArray(v) ? v.filter((x) => typeof x === "number") : []; } catch { return []; }
}

/**
 * For each active, auto-tracked subscription with an upcoming renewal, notify the
 * owner once per configured threshold. Idempotent: a threshold already recorded in
 * remindersSentJson is skipped; the ledger resets when the renewal date changes.
 */
export async function generateSubscriptionReminders(actorId: string | null, thresholds: number[] = DEFAULT_REMINDER_DAYS, now = new Date()): Promise<{ notified: number; scanned: number }> {
  let job = await prisma.backgroundJob.findFirst({ where: { name: REMINDER_JOB } });
  if (!job) job = await prisma.backgroundJob.create({ data: { name: REMINDER_JOB, type: "recurring", status: "queued", scheduleCron: "0 6 * * *" } });
  await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "running", lastRunAt: new Date() } });

  let notified = 0;
  let scanned = 0;
  try {
    const subs = await prisma.subscription.findMany({ where: { archivedAt: null, status: { in: ["active", "trial"] }, renewalDate: { not: null } } });
    for (const s of subs) {
      scanned++;
      if (!s.renewalDate) continue;
      const daysLeft = Math.ceil((s.renewalDate.getTime() - now.getTime()) / 86_400_000);
      if (daysLeft < 0) continue;
      const sent = parseSent(s.remindersSentJson);
      // Thresholds already reached (renewal is within them) but not yet reminded.
      const reached = thresholds.filter((t) => t >= daysLeft);
      const unsent = reached.filter((t) => !sent.includes(t));
      if (unsent.length === 0) continue;
      // Fire ONE reminder (the most urgent — smallest reached threshold), and mark
      // every reached threshold as sent so larger, already-passed ones don't fire
      // later. Re-running at the same daysLeft is then a no-op (idempotent).
      await notify([s.ownerId], {
        type: "subscription.renewal_due",
        title: `${s.provider} renews in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
        body: `${s.provider}${s.cost ? ` · ${s.cost} ${s.currency}` : ""} renews ${s.renewalDate.toISOString().slice(0, 10)}`,
        entityType: "Subscription", entityId: s.id,
      });
      await prisma.subscription.update({ where: { id: s.id }, data: { remindersSentJson: JSON.stringify([...new Set([...sent, ...reached])]) } });
      notified++;
    }
    if (job) await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "success", nextRunAt: new Date(now.getTime() + 86_400_000), lastError: null } });
    await prisma.systemEvent.create({ data: { type: "health", level: "info", message: `Subscription reminders: ${notified} sent across ${scanned} subscriptions`, metaJson: JSON.stringify({ notified, scanned }) } });
    if (actorId) await prisma.auditLog.create({ data: { actorId, action: "job.subscription_reminders", entityType: "BackgroundJob", summary: `${notified} notified, ${scanned} scanned` } });
  } catch (err) {
    if (job) await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "failed", lastError: String(err) } });
    await prisma.systemEvent.create({ data: { type: "error", level: "error", message: `Subscription reminders failed: ${String(err)}` } });
    throw err;
  }
  return { notified, scanned };
}
