import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { updateCountry } from "@/domain/org-admin";
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await updateCountry({ principal, ip, userAgent }, params.id, body));
});
