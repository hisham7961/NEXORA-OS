import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { recordWhatsappResults } from "@/domain/whatsapp";

/** POST /api/v1/whatsapp/:id/results — record delivery/engagement results. */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const wa = await recordWhatsappResults({ principal, ip, userAgent }, params.id, body);
  return ok(wa);
});
