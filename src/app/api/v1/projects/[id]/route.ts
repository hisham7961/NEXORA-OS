import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { updateProject, archiveProject } from "@/domain/org-admin";
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await updateProject({ principal, ip, userAgent }, params.id, body));
});
export const DELETE = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await archiveProject({ principal, ip, userAgent }, params.id);
  return ok({ id: params.id, archived: true });
});
