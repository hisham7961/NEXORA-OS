import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listCampaigns, campaignQuerySchema } from "@/domain/campaigns";

/** GET /api/v1/campaigns */
export const GET = route(async ({ principal, req }) => {
  const query = campaignQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listCampaigns(principal, query);
  return ok(rows, pageMeta(total, query));
});
