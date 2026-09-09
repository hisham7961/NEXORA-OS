import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getInvoice, updateInvoice } from "@/domain/accounting/ar";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const inv = await getInvoice(principal, params.id);
  if (!inv) throw new ServiceError("not_found", "Invoice not found", 404);
  return ok(inv);
});
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  return ok(await updateInvoice({ principal, ip, userAgent }, params.id, body));
});
