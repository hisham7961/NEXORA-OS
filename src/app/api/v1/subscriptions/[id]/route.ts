import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getSubscription, updateSubscription } from "@/domain/subscriptions";
export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const s = await getSubscription(principal, params.id);
  if (!s) throw new ServiceError("not_found", "Subscription not found", 404);
  return ok(s);
});
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await updateSubscription({ principal, ip, userAgent }, params.id, body));
});
