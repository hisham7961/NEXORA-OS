import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { confirmScheduled } from "@/domain/social";

/** POST /api/v1/social/:id/schedule — checkpoint 1: confirm scheduling. */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  const item = await confirmScheduled({ principal, ip, userAgent }, params.id);
  return ok(item);
});
