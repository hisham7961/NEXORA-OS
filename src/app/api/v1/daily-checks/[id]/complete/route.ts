import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { submitChecklistInstance } from "@/domain/daily-checks";

/** POST /api/v1/daily-checks/:id/complete — submit the instance as completed. */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await submitChecklistInstance({ principal, ip, userAgent }, params.id);
  return ok({ submitted: true });
});
