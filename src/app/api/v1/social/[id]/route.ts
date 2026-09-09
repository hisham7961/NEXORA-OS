import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getPublishingItem, updatePublishingItem } from "@/domain/social";

/** GET /api/v1/social/:id */
export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const data = await getPublishingItem(principal, params.id);
  if (!data) throw new ServiceError("not_found", "Publishing item not found", 404);
  return ok(data);
});

/** PATCH /api/v1/social/:id */
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const item = await updatePublishingItem({ principal, ip, userAgent }, params.id, body);
  return ok(item);
});
