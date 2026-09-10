import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getSupplierCredit } from "@/domain/accounting/ap";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const cr = await getSupplierCredit(principal, params.id);
  if (!cr) throw new ServiceError("not_found", "Supplier credit not found", 404);
  return ok(cr);
});
