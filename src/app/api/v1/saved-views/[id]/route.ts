import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { renameSavedView, deleteSavedView } from "@/domain/personal";

export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const name = (body as { name?: string }).name;
  if (!name) throw new ServiceError("missing_name", "name is required", 400);
  return ok(await renameSavedView({ principal, ip, userAgent }, params.id, name));
});
export const DELETE = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await deleteSavedView({ principal, ip, userAgent }, params.id);
  return ok({ id: params.id, deleted: true });
});
