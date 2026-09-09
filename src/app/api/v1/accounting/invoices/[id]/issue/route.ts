import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { issueInvoice } from "@/domain/accounting/ar";

export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  return ok(await issueInvoice({ principal, ip, userAgent }, params.id));
});
