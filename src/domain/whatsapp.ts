import { z } from "zod";
import type { WhatsappCampaign } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere } from "@/domain/scope";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, notify, type ActorContext } from "@/domain/mutation";
import { optionalString, optionalDate, optionalNumber } from "@/lib/validation";

const DIMS_BC = ["brandId", "countryId"] as const;

/** WhatsApp campaigns (§11) — third-party executed; internal workflow only. */
export const whatsappQuerySchema = listQuerySchema.extend({ status: z.string().optional(), brandId: z.string().optional() });
export type WhatsappQuery = z.infer<typeof whatsappQuerySchema>;

export async function listWhatsapp(principal: Principal, query: WhatsappQuery): Promise<{ rows: WhatsappCampaign[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "whatsapp.view", ["brandId", "countryId"], {
      ...(query.status ? { status: query.status } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ objective: { contains: query.q, mode: "insensitive" } }, { audience: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.whatsappCampaign.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.whatsappCampaign.count({ where }),
  ]);
  return { rows, total };
}

/** Detail for one WhatsApp campaign (§11), fail-closed on scope. */
export async function getWhatsappCampaign(principal: Principal, id: string) {
  const wa = await prisma.whatsappCampaign.findUnique({ where: { id } });
  if (!wa) return null;
  assertRecordInScope(principal, "whatsapp.view", { brandId: wa.brandId, countryId: wa.countryId }, [...DIMS_BC]);
  const results = wa.resultsJson ? safeParse(wa.resultsJson) : null;
  return { wa, results };
}

function safeParse(json: string): Record<string, number> | null {
  try { return JSON.parse(json) as Record<string, number>; } catch { return null; }
}

// ---------------------------------------------------------------------------
// WRITE PATH (§11, Phase 2 Part N) — brief → creative → review → approved →
// ready → sent → reported. Third-party executed; we run the internal workflow.
// ---------------------------------------------------------------------------

const WA_STATUSES = ["draft", "creative", "review", "approved", "ready", "sent", "reported"] as const;

/** Forward-only workflow (with a couple of backward review loops). */
const WA_NEXT: Record<string, string[]> = {
  draft: ["creative", "ready"],
  creative: ["review", "draft"],
  review: ["approved", "creative"],
  approved: ["ready", "review"],
  ready: ["sent"],
  sent: ["reported"],
  reported: [],
};

export const whatsappInputSchema = z.object({
  brandId: optionalString,
  countryId: optionalString,
  campaignId: optionalString,
  audience: optionalString,
  objective: optionalString,
  messageCopy: optionalString,
  plannedDate: optionalDate,
  responsibleUserId: optionalString,
});

function waScope(w: { brandId: string | null; countryId: string | null }) {
  return { brandId: w.brandId, countryId: w.countryId };
}

export async function createWhatsappCampaign(ctx: ActorContext, raw: unknown): Promise<WhatsappCampaign> {
  const input = whatsappInputSchema.parse(raw);
  const scope = { brandId: input.brandId ?? null, countryId: input.countryId ?? null };
  assertCan(ctx.principal, "whatsapp.create", scope);
  const wa = await prisma.whatsappCampaign.create({
    data: {
      ...scope, campaignId: input.campaignId ?? null, audience: input.audience ?? null,
      objective: input.objective ?? null, messageCopy: input.messageCopy ?? null,
      plannedDate: input.plannedDate ?? null, responsibleUserId: input.responsibleUserId ?? null,
      status: "draft",
    },
  });
  await audit(ctx, { action: "whatsapp.created", entityType: "WhatsappCampaign", entityId: wa.id, summary: input.objective ?? "WhatsApp campaign", brandId: wa.brandId });
  await notify([input.responsibleUserId], { type: "whatsapp.assigned", title: "You're responsible for a WhatsApp campaign", body: input.objective ?? undefined, entityType: "WhatsappCampaign", entityId: wa.id }, ctx.principal.userId);
  return wa;
}

async function loadEditableWa(ctx: ActorContext, id: string): Promise<WhatsappCampaign> {
  const wa = await prisma.whatsappCampaign.findUnique({ where: { id } });
  if (!wa || wa.archivedAt) throw new ServiceError("not_found", "WhatsApp campaign not found", 404);
  assertRecordInScope(ctx.principal, "whatsapp.edit", waScope(wa), [...DIMS_BC]);
  return wa;
}

export const whatsappUpdateSchema = whatsappInputSchema.partial();

export async function updateWhatsappCampaign(ctx: ActorContext, id: string, raw: unknown): Promise<WhatsappCampaign> {
  const existing = await loadEditableWa(ctx, id);
  const input = whatsappUpdateSchema.parse(raw);
  const data: Record<string, unknown> = {};
  for (const k of ["campaignId", "audience", "objective", "messageCopy", "plannedDate", "responsibleUserId"] as const) {
    if (input[k] !== undefined) data[k] = input[k];
  }
  const updated = await prisma.whatsappCampaign.update({ where: { id }, data });
  await audit(ctx, { action: "whatsapp.updated", entityType: "WhatsappCampaign", entityId: id, summary: "updated", brandId: existing.brandId, newValues: data });
  return updated;
}

/** Advance the workflow along an allowed transition (§11). */
export async function setWhatsappStatus(ctx: ActorContext, id: string, status: string): Promise<WhatsappCampaign> {
  if (!(WA_STATUSES as readonly string[]).includes(status)) throw new ServiceError("invalid_status", "Unknown WhatsApp status", 400);
  const existing = await loadEditableWa(ctx, id);
  const allowed = WA_NEXT[existing.status] ?? [];
  if (existing.status !== status && !allowed.includes(status)) {
    throw new ServiceError("invalid_transition", `Cannot move from ${existing.status} to ${status}`, 422);
  }
  // Approving requires the whatsapp.approve capability, in scope.
  if (status === "approved") assertCan(ctx.principal, "whatsapp.approve", waScope(existing));
  const updated = await prisma.whatsappCampaign.update({ where: { id }, data: { status } });
  await audit(ctx, { action: "whatsapp.status_changed", entityType: "WhatsappCampaign", entityId: id, summary: `${existing.status} → ${status}`, brandId: existing.brandId, oldValues: { status: existing.status }, newValues: { status } });
  return updated;
}

/** Mark the campaign sent (the third party executed it) — records the send time. */
export async function markWhatsappSent(ctx: ActorContext, id: string, sentAt?: Date): Promise<WhatsappCampaign> {
  const existing = await loadEditableWa(ctx, id);
  if (!["ready", "approved"].includes(existing.status)) {
    throw new ServiceError("not_ready", "Only an approved/ready campaign can be marked sent", 422);
  }
  const when = sentAt ?? new Date();
  const updated = await prisma.whatsappCampaign.update({ where: { id }, data: { status: "sent", sentAt: when, scheduledAt: existing.scheduledAt ?? when } });
  await audit(ctx, { action: "whatsapp.sent", entityType: "WhatsappCampaign", entityId: id, summary: `Sent ${when.toISOString().slice(0, 10)}`, brandId: existing.brandId });
  return updated;
}

export const whatsappResultsSchema = z.object({
  sent: optionalNumber,
  delivered: optionalNumber,
  read: optionalNumber,
  replied: optionalNumber,
  optOut: optionalNumber,
  conversions: optionalNumber,
  note: optionalString,
});

/** Record delivery/engagement results and move to reported (§11). */
export async function recordWhatsappResults(ctx: ActorContext, id: string, raw: unknown): Promise<WhatsappCampaign> {
  const existing = await loadEditableWa(ctx, id);
  if (existing.status !== "sent" && existing.status !== "reported") {
    throw new ServiceError("not_sent", "Enter results only after the campaign is sent", 422);
  }
  const input = whatsappResultsSchema.parse(raw);
  const results = {
    sent: input.sent ?? 0, delivered: input.delivered ?? 0, read: input.read ?? 0,
    replied: input.replied ?? 0, optOut: input.optOut ?? 0, conversions: input.conversions ?? 0,
    note: input.note ?? null,
  };
  const updated = await prisma.whatsappCampaign.update({ where: { id }, data: { status: "reported", resultsJson: JSON.stringify(results) } });
  await audit(ctx, { action: "whatsapp.results_recorded", entityType: "WhatsappCampaign", entityId: id, summary: `Delivered ${results.delivered} · replied ${results.replied}`, brandId: existing.brandId });
  return updated;
}

export { WA_NEXT };
