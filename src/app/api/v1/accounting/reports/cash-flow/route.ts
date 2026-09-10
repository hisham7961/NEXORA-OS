import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { cashFlow } from "@/domain/accounting/statements";

export const GET = route(async ({ principal, req }) => {
  const u = new URL(req.url); const companyId = u.searchParams.get("companyId");
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  const now = new Date();
  const from = u.searchParams.get("from"); const to = u.searchParams.get("to");
  return ok(await cashFlow(principal, companyId, from ? new Date(from) : new Date(now.getFullYear(), 0, 1), to ? new Date(to) : now));
});
