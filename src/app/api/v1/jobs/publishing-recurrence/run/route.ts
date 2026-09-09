import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { generateRecurringPublishing } from "@/domain/social";

/** POST /api/v1/jobs/publishing-recurrence/run — materialize recurring items (idempotent). */
export const POST = route(async ({ principal }) => {
  if (!canAnywhere(principal, "social.manage")) throw new ForbiddenError("social.manage");
  const result = await generateRecurringPublishing(principal.userId);
  return ok(result);
});
