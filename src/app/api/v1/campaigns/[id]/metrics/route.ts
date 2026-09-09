import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { addCampaignMetric, deleteCampaignMetric } from "@/domain/campaigns";

/** POST /api/v1/campaigns/[id]/metrics — record a campaign metric (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await addCampaignMetric({ principal, ip, userAgent }, params.id, body));
});

/** DELETE /api/v1/campaigns/[id]/metrics — remove a metric via {metricId} (§30 parity). */
export const DELETE = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const metricId = (body as { metricId?: string }).metricId;
  if (!metricId) throw new ServiceError("missing_metric", "metricId is required", 400);
  await deleteCampaignMetric({ principal, ip, userAgent }, params.id, metricId);
  return ok({ id: params.id, removed: metricId });
});
