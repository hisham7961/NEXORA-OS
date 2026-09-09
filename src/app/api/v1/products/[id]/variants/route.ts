import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { addProductVariant } from "@/domain/products";

/** POST /api/v1/products/[id]/variants — add a variant (§7 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  await addProductVariant({ principal, ip, userAgent }, params.id, body);
  return ok({ id: params.id, added: true });
});
