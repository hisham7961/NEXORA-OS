import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { initializeCompanyAccounting } from "@/domain/accounting/bootstrap";
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const companyId = (body as { companyId?: string }).companyId;
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  return ok(await initializeCompanyAccounting({ principal, ip, userAgent }, companyId, { baseCurrency: (body as { baseCurrency?: string }).baseCurrency }));
});
