import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getDesign, updateDesignRequest } from "@/domain/design";

/** GET /api/v1/design/:id */
export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const dr = await getDesign(principal, params.id);
  if (!dr) throw new ServiceError("not_found", "Design request not found", 404);
  return ok(dr);
});

/** PATCH /api/v1/design/:id */
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const dr = await updateDesignRequest({ principal, ip, userAgent }, params.id, body);
  return ok(dr);
});
