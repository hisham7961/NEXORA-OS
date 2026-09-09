import { route, ServiceError } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listTasks, createTask, taskQuerySchema } from "@/domain/tasks";

/** GET /api/v1/tasks — scoped, paginated list. */
export const GET = route(async ({ principal, req }) => {
  const query = taskQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listTasks(principal, query);
  return ok(rows, pageMeta(total, query));
});

/** POST /api/v1/tasks — create a task (same domain logic as the web app). */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => {
    throw new ServiceError("invalid_json", "Request body must be valid JSON", 400);
  });
  const task = await createTask({ principal, ip, userAgent }, body);
  return created({ id: task.id });
});
