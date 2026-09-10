import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getBill, updateBill } from "@/domain/accounting/ap";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const b = await getBill(principal, params.id);
  if (!b) throw new ServiceError("not_found", "Bill not found", 404);
  return ok(b);
});
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  return ok(await updateBill({ principal, ip, userAgent }, params.id, body));
});
