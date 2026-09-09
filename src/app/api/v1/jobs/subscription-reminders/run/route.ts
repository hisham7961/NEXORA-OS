import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { generateSubscriptionReminders } from "@/domain/subscriptions";

/** POST /api/v1/jobs/subscription-reminders/run — idempotent renewal reminders. */
export const POST = route(async ({ principal }) => {
  if (!canAnywhere(principal, "subscriptions.manage")) throw new ForbiddenError("subscriptions.manage");
  return ok(await generateSubscriptionReminders(principal.userId));
});
