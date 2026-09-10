import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { companyFinancialOverview } from "@/domain/accounting/intelligence";

export const GET = route(async ({ principal, req }) => {
  const u = new URL(req.url); const companyId = u.searchParams.get("companyId");
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  return ok(await companyFinancialOverview(principal, companyId));
});
