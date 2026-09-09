import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listTaxRates, createTaxRate } from "@/domain/accounting/setup";
export const GET = route(async ({ principal, req }) => {
  const companyId = new URL(req.url).searchParams.get("companyId");
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  return ok(await listTaxRates(principal, companyId));
});
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const { companyId, ...rest } = body as { companyId?: string };
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  return ok(await createTaxRate({ principal, ip, userAgent }, companyId, rest));
});
