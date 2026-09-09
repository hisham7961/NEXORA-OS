import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { backfillCampaignSpend } from "@/domain/campaigns";

/**
 * POST /api/v1/jobs/campaign-spend-backfill/run — one-time (idempotent) migration
 * of the derived-spend model: recompute actualSpend from spend metrics, and
 * preserve any legacy directly-entered actualSpend as a migrated spend metric.
 */
export const POST = route(async ({ principal }) => {
  if (!canAnywhere(principal, "campaigns.manage")) throw new ForbiddenError("campaigns.manage");
  const result = await backfillCampaignSpend(principal.userId);
  return ok(result);
});
