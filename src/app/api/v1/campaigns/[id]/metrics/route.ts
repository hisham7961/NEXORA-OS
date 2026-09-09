import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { addCampaignMetric } from "@/domain/campaigns";

/** POST /api/v1/campaigns/[id]/metrics — record a campaign metric (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await addCampaignMetric({ principal, ip, userAgent }, params.id, body));
});
