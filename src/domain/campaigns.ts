import { z } from "zod";
import type { Campaign } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, notify, type ActorContext } from "@/domain/mutation";
import { optionalString, optionalNumber, optionalDate } from "@/lib/validation";

/** Campaigns list query = base list params + module-specific filters (§9). */
export const campaignQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  brandId: z.string().optional(),
  type: z.string().optional(),
});
export type CampaignQuery = z.infer<typeof campaignQuerySchema>;

/**
 * List campaigns inside the caller's scope (§3, §69). Campaign carries
 * companyId/brandId/countryId, so the permission-derived filter uses DIMS_CBC.
 */
export async function listCampaigns(
  principal: Principal,
  query: CampaignQuery,
): Promise<{ rows: Campaign[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "campaigns.view", DIMS_CBC, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };

  const [rows, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.campaign.count({ where }),
  ]);

  return { rows, total };
}

/**
 * Load a campaign's full 360 context (§44): linked products, metrics, reports
 * and related tasks. Fail-closed on scope so a brand/country-scoped user cannot
 * open a campaign outside their reach (§69).
 */
export async function getCampaign(principal: Principal, id: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return null;
  assertRecordInScope(
    principal,
    "campaigns.view",
    { companyId: campaign.companyId, brandId: campaign.brandId, countryId: campaign.countryId },
    DIMS_CBC,
  );

  const [campaignProducts, metrics, reports, tasks] = await Promise.all([
    prisma.campaignProduct.findMany({ where: { campaignId: id } }),
    prisma.campaignMetric.findMany({
      where: { campaignId: id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.campaignReport.findMany({ where: { campaignId: id }, orderBy: { date: "desc" }, take: 50 }),
    prisma.task.findMany({
      where: { campaignId: id, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  return { campaign, campaignProducts, metrics, reports, tasks };
}

// ---------------------------------------------------------------------------
// WRITE PATHS (§9, Phase 2 Part K) — create/edit/status/metrics.
// Every mutation: permission (scoped) → validation → transaction when needed →
// audit → notification → activity timeline (via AuditLog).
// ---------------------------------------------------------------------------

/** Configurable lifecycle — kept in sync with the list/detail status options (§7). */
const CAMPAIGN_STATUSES = [
  "draft", "planning", "waiting_creative", "creative_review", "ready",
  "scheduled", "live", "monitoring", "reporting", "completed", "cancelled",
] as const;
const CAMPAIGN_TYPES = [
  "meta", "instagram", "facebook", "tiktok", "snapchat", "google",
  "influencer", "whatsapp", "email", "offline", "retail", "custom",
] as const;
const METRIC_NAMES = [
  "spend", "impressions", "reach", "clicks", "ctr", "cpc", "cpm",
  "leads", "conversions", "orders", "revenue", "roas", "custom",
] as const;

export const campaignInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  type: z.enum(CAMPAIGN_TYPES),
  objective: optionalString,
  companyId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  storeId: optionalString,
  ownerId: optionalString,
  currency: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : undefined), z.string().min(1).max(8).default("KWD")),
  plannedBudget: optionalNumber,
  actualSpend: optionalNumber,
  targetAudience: optionalString,
  startDate: optionalDate,
  endDate: optionalDate,
  notes: optionalString,
});

function campaignScope(c: { companyId: string | null; brandId: string | null; countryId: string | null }) {
  return { companyId: c.companyId, brandId: c.brandId, countryId: c.countryId };
}

export async function createCampaign(ctx: ActorContext, raw: unknown): Promise<Campaign> {
  const input = campaignInputSchema.parse(raw);
  const scope = { companyId: input.companyId ?? null, brandId: input.brandId ?? null, countryId: input.countryId ?? null };
  assertCan(ctx.principal, "campaigns.create", scope);
  const campaign = await prisma.campaign.create({
    data: {
      name: input.name, type: input.type, objective: input.objective ?? null, ...scope,
      storeId: input.storeId ?? null, ownerId: input.ownerId ?? null, currency: input.currency,
      plannedBudget: input.plannedBudget ?? null, actualSpend: input.actualSpend ?? null,
      targetAudience: input.targetAudience ?? null, startDate: input.startDate ?? null,
      endDate: input.endDate ?? null, notes: input.notes ?? null, status: "draft",
      createdById: ctx.principal.userId,
    },
  });
  await audit(ctx, { action: "campaign.created", entityType: "Campaign", entityId: campaign.id, summary: input.name, brandId: campaign.brandId, companyId: campaign.companyId });
  await notify([input.ownerId], { type: "campaign.assigned", title: "You own a new campaign", body: input.name, entityType: "Campaign", entityId: campaign.id }, ctx.principal.userId);
  return campaign;
}

async function loadEditableCampaign(ctx: ActorContext, id: string): Promise<Campaign> {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.archivedAt) throw new ServiceError("not_found", "Campaign not found", 404);
  assertRecordInScope(ctx.principal, "campaigns.edit", campaignScope(campaign), DIMS_CBC);
  return campaign;
}

export const campaignUpdateSchema = campaignInputSchema.partial();

export async function updateCampaign(ctx: ActorContext, id: string, raw: unknown): Promise<Campaign> {
  const existing = await loadEditableCampaign(ctx, id);
  const input = campaignUpdateSchema.parse(raw);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "type", "objective", "storeId", "ownerId", "currency", "plannedBudget", "actualSpend", "targetAudience", "startDate", "endDate", "notes"] as const) {
    if (input[k] !== undefined) data[k] = input[k];
  }
  const updated = await prisma.campaign.update({ where: { id }, data });
  await audit(ctx, { action: "campaign.updated", entityType: "Campaign", entityId: id, summary: "updated", brandId: existing.brandId, companyId: existing.companyId, newValues: data });
  if (input.ownerId && input.ownerId !== existing.ownerId) {
    await notify([input.ownerId], { type: "campaign.assigned", title: "You own a campaign", body: existing.name, entityType: "Campaign", entityId: id }, ctx.principal.userId);
  }
  return updated;
}

export async function setCampaignStatus(ctx: ActorContext, id: string, status: string): Promise<Campaign> {
  if (!(CAMPAIGN_STATUSES as readonly string[]).includes(status)) throw new ServiceError("invalid_status", "Unknown campaign status", 400);
  const existing = await loadEditableCampaign(ctx, id);
  if (existing.status === status) return existing;
  const updated = await prisma.campaign.update({ where: { id }, data: { status } });
  await audit(ctx, { action: "campaign.status_changed", entityType: "Campaign", entityId: id, summary: `${existing.status} → ${status}`, brandId: existing.brandId, companyId: existing.companyId, oldValues: { status: existing.status }, newValues: { status } });
  return updated;
}

export const metricInputSchema = z.object({
  name: z.enum(METRIC_NAMES),
  value: z.coerce.number({ invalid_type_error: "A numeric value is required" }),
  unit: optionalString,
  isTarget: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
  date: optionalDate,
  note: optionalString,
});

/**
 * Record a manual performance metric (§9). Actual (non-target) spend keeps the
 * campaign's `actualSpend` in sync so the budget panel reflects reality — done
 * atomically with the metric row.
 */
export async function addCampaignMetric(ctx: ActorContext, campaignId: string, raw: unknown) {
  const existing = await loadEditableCampaign(ctx, campaignId);
  const input = metricInputSchema.parse(raw);
  const metric = await prisma.$transaction(async (tx) => {
    const m = await tx.campaignMetric.create({
      data: {
        campaignId, name: input.name, value: input.value, unit: input.unit ?? null,
        isTarget: input.isTarget, date: input.date ?? new Date(), note: input.note ?? null,
      },
    });
    if (input.name === "spend" && !input.isTarget) {
      const agg = await tx.campaignMetric.aggregate({ where: { campaignId, name: "spend", isTarget: false }, _sum: { value: true } });
      await tx.campaign.update({ where: { id: campaignId }, data: { actualSpend: agg._sum.value ?? input.value } });
    }
    return m;
  });
  await audit(ctx, { action: "campaign.metric_added", entityType: "Campaign", entityId: campaignId, summary: `${input.isTarget ? "target " : ""}${input.name}: ${input.value}`, brandId: existing.brandId, companyId: existing.companyId });
  return metric;
}
