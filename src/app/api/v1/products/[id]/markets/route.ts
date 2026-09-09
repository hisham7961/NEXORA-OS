import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { setProductMarket, removeProductMarket } from "@/domain/products";

/** POST /api/v1/products/[id]/markets — set market availability (§7 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const { countryId, status } = body as { countryId?: string; status?: string };
  if (!countryId) throw new ServiceError("missing_country", "countryId is required", 400);
  await setProductMarket({ principal, ip, userAgent }, params.id, countryId, status ?? "planned");
  return ok({ id: params.id, countryId });
});

export const DELETE = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const { countryId } = body as { countryId?: string };
  if (!countryId) throw new ServiceError("missing_country", "countryId is required", 400);
  await removeProductMarket({ principal, ip, userAgent }, params.id, countryId);
  return ok({ id: params.id, removed: countryId });
});
