import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listComments, addComment } from "@/domain/comments";

export const GET = route(async ({ principal, req }) => {
  const u = new URL(req.url); const entityType = u.searchParams.get("entityType"); const entityId = u.searchParams.get("entityId");
  if (!entityType || !entityId) throw new ServiceError("missing", "entityType and entityId are required", 400);
  return ok(await listComments(principal, entityType, entityId));
});
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  return ok(await addComment({ principal, ip, userAgent }, body));
});
