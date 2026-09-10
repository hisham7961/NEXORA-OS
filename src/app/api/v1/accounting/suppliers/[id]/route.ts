import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getSupplier, updateSupplier, setSupplierActive, archiveSupplier } from "@/domain/accounting/suppliers";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const s = await getSupplier(principal, params.id);
  if (!s) throw new ServiceError("not_found", "Supplier not found", 404);
  return ok(s);
});
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  if (typeof (body as { isActive?: boolean }).isActive === "boolean") { await setSupplierActive({ principal, ip, userAgent }, params.id, (body as { isActive: boolean }).isActive); return ok({ id: params.id }); }
  return ok(await updateSupplier({ principal, ip, userAgent }, params.id, body));
});
export const DELETE = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await archiveSupplier({ principal, ip, userAgent }, params.id);
  return ok({ id: params.id, archived: true });
});
