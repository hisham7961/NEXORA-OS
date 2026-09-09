import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listDesign, createDesignRequest, designQuerySchema } from "@/domain/design";

/** GET /api/v1/design */
export const GET = route(async ({ principal, req }) => {
  const query = designQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listDesign(principal, query);
  return ok(rows, pageMeta(total, query));
});

/** POST /api/v1/design — create a creative request. */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const dr = await createDesignRequest({ principal, ip, userAgent }, body);
  return ok(dr);
});
