import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getProduct, updateProduct, archiveProduct } from "@/domain/products";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const data = await getProduct(principal, params.id);
  if (!data) throw new ServiceError("not_found", "Product not found", 404);
  return ok(data);
});

export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await updateProduct({ principal, ip, userAgent }, params.id, body));
});

export const DELETE = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await archiveProduct({ principal, ip, userAgent }, params.id);
  return ok({ id: params.id, archived: true });
});
