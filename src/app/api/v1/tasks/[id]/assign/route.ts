import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { assignTask } from "@/domain/tasks";

/** POST /api/v1/tasks/[id]/assign — set assignees/watchers (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const assigneeIds = (body as { assigneeIds?: string[] }).assigneeIds ?? [];
  const watcherIds = (body as { watcherIds?: string[] }).watcherIds ?? [];
  await assignTask({ principal, ip, userAgent }, params.id, assigneeIds, watcherIds);
  return ok({ id: params.id, assigned: true });
});
