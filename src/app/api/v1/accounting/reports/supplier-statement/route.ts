import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { supplierStatement } from "@/domain/accounting/ap";

export const GET = route(async ({ principal, req }) => {
  const u = new URL(req.url);
  const companyId = u.searchParams.get("companyId");
  const supplierId = u.searchParams.get("supplierId");
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  if (!supplierId) throw new ServiceError("missing_supplier", "supplierId is required", 400);
  const from = u.searchParams.get("from"); const to = u.searchParams.get("to");
  return ok(await supplierStatement(principal, companyId, supplierId, from ? new Date(from) : undefined, to ? new Date(to) : undefined));
});
