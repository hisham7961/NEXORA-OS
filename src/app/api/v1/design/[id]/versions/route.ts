import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { addDesignVersion } from "@/domain/design";

/** POST /api/v1/design/:id/versions — upload a new creative version. */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const v = await addDesignVersion({ principal, ip, userAgent }, params.id, body);
  return ok(v);
});
