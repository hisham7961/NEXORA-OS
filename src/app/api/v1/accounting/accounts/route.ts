import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listChartOfAccounts, createAccount } from "@/domain/accounting/accounts";
export const GET = route(async ({ principal, req }) => {
  const u = new URL(req.url); const companyId = u.searchParams.get("companyId");
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  return ok(await listChartOfAccounts(principal, companyId, { includeInactive: u.searchParams.get("all") === "1" }));
});
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const { companyId, ...rest } = body as { companyId?: string };
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  return ok(await createAccount({ principal, ip, userAgent }, companyId, rest));
});
