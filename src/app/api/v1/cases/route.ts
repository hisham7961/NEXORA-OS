import { route, ServiceError } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listCases, createCase, caseQuerySchema } from "@/domain/cases";

/** GET /api/v1/cases — scoped list. */
export const GET = route(async ({ principal, req }) => {
  const query = caseQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listCases(principal, query);
  return ok(rows, pageMeta(total, query));
});

/** POST /api/v1/cases — create a customer case within scope. */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => {
    throw new ServiceError("invalid_json", "Request body must be valid JSON", 400);
  });
  const c = await createCase({ principal, ip, userAgent }, body);
  return created({ id: c.id });
});
