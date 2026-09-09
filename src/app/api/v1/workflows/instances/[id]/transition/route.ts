import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { performTransition } from "@/domain/workflows";

/** Move an instance along a transition (enforces permission + stage gates). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await performTransition({ principal, ip, userAgent }, params.id, body));
});
