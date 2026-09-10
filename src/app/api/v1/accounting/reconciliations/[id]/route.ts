import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getReconciliation } from "@/domain/accounting/bank";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const r = await getReconciliation(principal, params.id);
  if (!r) throw new ServiceError("not_found", "Reconciliation not found", 404);
  return ok(r);
});
