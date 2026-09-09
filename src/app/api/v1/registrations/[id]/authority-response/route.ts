import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { recordAuthorityResponse } from "@/domain/registrations";

/** POST /api/v1/registrations/[id]/authority-response — log an authority response (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const text = (body as { text?: string }).text;
  if (!text) throw new ServiceError("missing_text", "text is required", 400);
  await recordAuthorityResponse({ principal, ip, userAgent }, params.id, text);
  return ok({ id: params.id, recorded: true });
});
