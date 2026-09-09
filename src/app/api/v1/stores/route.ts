import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listStores, storeQuerySchema } from "@/domain/stores";

/** GET /api/v1/stores */
export const GET = route(async ({ principal, req }) => {
  const query = storeQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listStores(principal, query);
  return ok(rows, pageMeta(total, query));
});
