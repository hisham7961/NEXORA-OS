import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listCases, caseQuerySchema } from "@/domain/cases";

/** GET /api/v1/cases */
export const GET = route(async ({ principal, req }) => {
  const query = caseQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listCases(principal, query);
  return ok(rows, pageMeta(total, query));
});
