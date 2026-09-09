import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { allocateReceipt } from "@/domain/accounting/ar";

export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const allocations = (body as { allocations?: { invoiceId: string; amount: number }[] }).allocations ?? [];
  await allocateReceipt({ principal, ip, userAgent }, params.id, allocations);
  return ok({ id: params.id, allocated: true });
});
