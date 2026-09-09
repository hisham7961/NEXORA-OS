import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { renewSubscription } from "@/domain/subscriptions";
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  return ok(await renewSubscription({ principal, ip, userAgent }, params.id));
});
