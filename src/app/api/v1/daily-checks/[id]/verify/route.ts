import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { verifyChecklistInstance } from "@/domain/daily-checks";

/** POST /api/v1/daily-checks/:id/verify — supervisor verification (daily_checks.manage). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await verifyChecklistInstance({ principal, ip, userAgent }, params.id);
  return ok({ verified: true });
});
