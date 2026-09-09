import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { arAging } from "@/domain/accounting/ar";

export const GET = route(async ({ principal, req }) => {
  const u = new URL(req.url); const companyId = u.searchParams.get("companyId");
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  const asOf = u.searchParams.get("asOf");
  return ok(await arAging(principal, companyId, asOf ? new Date(asOf) : undefined));
});
