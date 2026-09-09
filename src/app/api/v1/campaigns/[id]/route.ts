import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getCampaign, updateCampaign } from "@/domain/campaigns";

/** GET /api/v1/campaigns/:id — single campaign 360, fail-closed on scope. */
export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const data = await getCampaign(principal, params.id);
  if (!data) throw new ServiceError("not_found", "Campaign not found", 404);
  return ok(data);
});

/** PATCH /api/v1/campaigns/:id — update brief / budget / owner. */
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => {
    throw new ServiceError("invalid_json", "Request body must be valid JSON", 400);
  });
  const campaign = await updateCampaign({ principal, ip, userAgent }, params.id, body);
  return ok(campaign);
});
