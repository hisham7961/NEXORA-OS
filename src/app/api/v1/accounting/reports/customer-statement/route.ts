import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { customerStatement } from "@/domain/accounting/ar";

export const GET = route(async ({ principal, req }) => {
  const u = new URL(req.url);
  const companyId = u.searchParams.get("companyId");
  const customerId = u.searchParams.get("customerId");
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  if (!customerId) throw new ServiceError("missing_customer", "customerId is required", 400);
  const from = u.searchParams.get("from"); const to = u.searchParams.get("to");
  return ok(await customerStatement(principal, companyId, customerId, from ? new Date(from) : undefined, to ? new Date(to) : undefined));
});
