import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listCampaigns, createCampaign, campaignQuerySchema } from "@/domain/campaigns";

/** GET /api/v1/campaigns */
export const GET = route(async ({ principal, req }) => {
  const query = campaignQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listCampaigns(principal, query);
  return ok(rows, pageMeta(total, query));
});

/** POST /api/v1/campaigns — create a campaign (permission + validation enforced in the service). */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => {
    throw new ServiceError("invalid_json", "Request body must be valid JSON", 400);
  });
  const campaign = await createCampaign({ principal, ip, userAgent }, body);
  return ok(campaign);
});
