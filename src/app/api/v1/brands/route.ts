import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listBrands, brandQuerySchema } from "@/domain/brands";

/** GET /api/v1/brands — scoped, paginated brand list (same service the web app uses). */
export const GET = route(async ({ principal, req }) => {
  const query = brandQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listBrands(principal, query);
  return ok(rows, pageMeta(total, query));
});
