import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getBankAccount, updateBankAccount, setBankAccountActive } from "@/domain/accounting/bank";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const b = await getBankAccount(principal, params.id);
  if (!b) throw new ServiceError("not_found", "Bank account not found", 404);
  return ok(b);
});
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  if (typeof (body as { isActive?: boolean }).isActive === "boolean") { await setBankAccountActive({ principal, ip, userAgent }, params.id, (body as { isActive: boolean }).isActive); return ok({ id: params.id }); }
  return ok(await updateBankAccount({ principal, ip, userAgent }, params.id, body));
});
