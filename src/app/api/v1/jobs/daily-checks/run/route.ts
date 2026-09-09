import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { generateDailyChecks } from "@/domain/daily-checks";

/** POST /api/v1/jobs/daily-checks/run — trigger the recurring generator (idempotent). */
export const POST = route(async ({ principal }) => {
  if (!canAnywhere(principal, "daily_checks.manage")) throw new ForbiddenError("daily_checks.manage");
  const result = await generateDailyChecks(principal.userId);
  return ok(result);
});
