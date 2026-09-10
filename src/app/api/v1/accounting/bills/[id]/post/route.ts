import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { postBill } from "@/domain/accounting/ap";

export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  return ok(await postBill({ principal, ip, userAgent }, params.id));
});
