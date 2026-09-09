import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getReceipt } from "@/domain/accounting/ar";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const r = await getReceipt(principal, params.id);
  if (!r) throw new ServiceError("not_found", "Receipt not found", 404);
  return ok(r);
});
