import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listInstances, startWorkflowInstance, instanceQuerySchema } from "@/domain/workflows";

/** Operational monitor: workflow instances in scope (filter ?status/?overdue/?definitionId). */
export const GET = route(async ({ principal, req }) => {
  const query = instanceQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listInstances(principal, query);
  return ok(rows, pageMeta(total, query));
});

/** Start (bind) a workflow instance for a record. */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await startWorkflowInstance({ principal, ip, userAgent }, body));
});
