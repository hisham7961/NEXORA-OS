import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { addDependency } from "@/domain/tasks";
/** POST /api/v1/tasks/[id]/dependencies — add a task dependency (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const dependsOnTaskId = (body as { dependsOnTaskId?: string }).dependsOnTaskId;
  if (!dependsOnTaskId) throw new ServiceError("missing_dep", "dependsOnTaskId is required", 400);
  await addDependency({ principal, ip, userAgent }, params.id, dependsOnTaskId);
  return ok({ id: params.id, dependsOn: dependsOnTaskId });
});
