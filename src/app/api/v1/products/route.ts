import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listProducts, productQuerySchema } from "@/domain/products";

/** GET /api/v1/products */
export const GET = route(async ({ principal, req }) => {
  const query = productQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listProducts(principal, query);
  return ok(rows, pageMeta(total, query));
});
