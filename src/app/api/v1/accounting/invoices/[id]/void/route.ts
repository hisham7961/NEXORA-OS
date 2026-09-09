import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { voidInvoice } from "@/domain/accounting/ar";

export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => ({}));
  const reason = (body as { reason?: string }).reason ?? "";
  return ok(await voidInvoice({ principal, ip, userAgent }, params.id, reason));
});
