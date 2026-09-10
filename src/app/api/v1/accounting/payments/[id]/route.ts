import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getPayment } from "@/domain/accounting/ap";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const p = await getPayment(principal, params.id);
  if (!p) throw new ServiceError("not_found", "Payment not found", 404);
  return ok(p);
});
