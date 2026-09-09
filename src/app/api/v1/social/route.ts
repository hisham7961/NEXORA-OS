import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listPublishing, createPublishingItem, socialQuerySchema } from "@/domain/social";

/** GET /api/v1/social — publishing items in scope. */
export const GET = route(async ({ principal, req }) => {
  const query = socialQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listPublishing(principal, query);
  return ok(rows, pageMeta(total, query));
});

/** POST /api/v1/social — plan a new publishing item. */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const item = await createPublishingItem({ principal, ip, userAgent }, body);
  return ok(item);
});
