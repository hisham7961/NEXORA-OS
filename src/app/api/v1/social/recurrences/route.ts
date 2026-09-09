import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { createRecurrence } from "@/domain/social";
/** POST /api/v1/social/recurrences — create a publishing recurrence (§30 parity). */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await createRecurrence({ principal, ip, userAgent }, body));
});
