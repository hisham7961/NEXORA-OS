import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { completeReconciliation } from "@/domain/accounting/bank";

export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => ({}));
  return ok(await completeReconciliation({ principal, ip, userAgent }, params.id, { force: (body as { force?: boolean }).force }));
});
