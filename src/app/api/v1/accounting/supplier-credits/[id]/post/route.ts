import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { postSupplierCredit } from "@/domain/accounting/ap";

export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  return ok(await postSupplierCredit({ principal, ip, userAgent }, params.id));
});
