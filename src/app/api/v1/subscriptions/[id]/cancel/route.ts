import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { cancelSubscription } from "@/domain/subscriptions";

/** POST /api/v1/subscriptions/[id]/cancel — stop a subscription (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  return ok(await cancelSubscription({ principal, ip, userAgent }, params.id));
});
