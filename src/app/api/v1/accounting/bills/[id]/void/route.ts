import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { voidBill } from "@/domain/accounting/ap";

export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => ({}));
  return ok(await voidBill({ principal, ip, userAgent }, params.id, (body as { reason?: string }).reason ?? ""));
});
