import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { escalateOverdueInstances } from "@/domain/workflows";

/** POST /api/v1/jobs/workflow-escalations/run — idempotent SLA escalation sweep. */
export const POST = route(async ({ principal }) => {
  if (!canAnywhere(principal, "workflows.manage")) throw new ForbiddenError("workflows.manage");
  return ok(await escalateOverdueInstances(principal.userId));
});
