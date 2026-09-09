import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listTasks, taskQuerySchema } from "@/domain/tasks";

/** GET /api/v1/tasks */
export const GET = route(async ({ principal, req }) => {
  const query = taskQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listTasks(principal, query);
  return ok(rows, pageMeta(total, query));
});
