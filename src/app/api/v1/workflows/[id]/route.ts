import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getWorkflow, updateWorkflowMeta, archiveWorkflow } from "@/domain/workflows";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const def = await getWorkflow(principal, params.id);
  if (!def) throw new ServiceError("not_found", "Workflow not found", 404);
  return ok(def);
});

export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  await updateWorkflowMeta({ principal, ip, userAgent }, params.id, body);
  return ok({ id: params.id });
});

export const DELETE = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await archiveWorkflow({ principal, ip, userAgent }, params.id);
  return ok({ id: params.id, archived: true });
});
