import { z } from "zod";
import type { Campaign } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";

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
