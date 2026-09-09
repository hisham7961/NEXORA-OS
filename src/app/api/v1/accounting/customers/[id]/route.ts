import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getCustomer, updateCustomer, setCustomerActive, archiveCustomer } from "@/domain/accounting/customers";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const c = await getCustomer(principal, params.id);
  if (!c) throw new ServiceError("not_found", "Customer not found", 404);
  return ok(c);
});
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  if (typeof (body as { isActive?: boolean }).isActive === "boolean") { await setCustomerActive({ principal, ip, userAgent }, params.id, (body as { isActive: boolean }).isActive); return ok({ id: params.id }); }
  return ok(await updateCustomer({ principal, ip, userAgent }, params.id, body));
});
export const DELETE = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await archiveCustomer({ principal, ip, userAgent }, params.id);
  return ok({ id: params.id, archived: true });
});
