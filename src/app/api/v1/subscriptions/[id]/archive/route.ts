import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { archiveSubscription } from "@/domain/subscriptions";

/** POST /api/v1/subscriptions/[id]/archive — soft-delete a subscription (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await archiveSubscription({ principal, ip, userAgent }, params.id);
  return ok({ id: params.id, archived: true });
});
