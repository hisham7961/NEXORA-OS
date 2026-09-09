import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getTask, updateTask } from "@/domain/tasks";

/** GET /api/v1/tasks/:id — single task, fail-closed on scope. */
export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const task = await getTask(principal, params.id);
  if (!task) throw new ServiceError("not_found", "Task not found", 404);
  return ok(task);
});

/** PATCH /api/v1/tasks/:id — update fields and/or status. */
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => {
    throw new ServiceError("invalid_json", "Request body must be valid JSON", 400);
  });
  const task = await updateTask({ principal, ip, userAgent }, params.id, body);
  return ok(task);
});
