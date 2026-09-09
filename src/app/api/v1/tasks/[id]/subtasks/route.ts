import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { addSubtask } from "@/domain/tasks";
/** POST /api/v1/tasks/[id]/subtasks — add a subtask (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const title = (body as { title?: string }).title;
  if (!title) throw new ServiceError("missing_title", "title is required", 400);
  return ok(await addSubtask({ principal, ip, userAgent }, params.id, title));
});
