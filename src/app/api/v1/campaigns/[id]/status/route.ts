import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { setCampaignStatus } from "@/domain/campaigns";

/** POST /api/v1/campaigns/[id]/status — change lifecycle status (mobile/API parity §30). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const status = (body as { status?: string }).status;
  if (!status) throw new ServiceError("missing_status", "status is required", 400);
  return ok(await setCampaignStatus({ principal, ip, userAgent }, params.id, status));
});
