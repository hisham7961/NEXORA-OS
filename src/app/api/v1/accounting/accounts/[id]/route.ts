import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAccount, updateAccount, archiveAccount, setAccountActive } from "@/domain/accounting/accounts";
export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const a = await getAccount(principal, params.id);
  if (!a) throw new ServiceError("not_found", "Account not found", 404);
  return ok(a);
});
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  if (typeof (body as { isActive?: boolean }).isActive === "boolean") { await setAccountActive({ principal, ip, userAgent }, params.id, (body as { isActive: boolean }).isActive); return ok({ id: params.id }); }
  return ok(await updateAccount({ principal, ip, userAgent }, params.id, body));
});
export const DELETE = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await archiveAccount({ principal, ip, userAgent }, params.id);
  return ok({ id: params.id, archived: true });
});
