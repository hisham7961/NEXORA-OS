import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listProducts, createProduct, productQuerySchema } from "@/domain/products";

/** GET /api/v1/products */
export const GET = route(async ({ principal, req }) => {
  const query = productQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listProducts(principal, query);
  return ok(rows, pageMeta(total, query));
});

/** POST /api/v1/products — create a product (§7 parity). */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await createProduct({ principal, ip, userAgent }, body));
});
