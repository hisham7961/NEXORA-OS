import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAccountingSettings, upsertAccountingSettings } from "@/domain/accounting/settings";
export const GET = route(async ({ principal, req }) => {
  const companyId = new URL(req.url).searchParams.get("companyId");
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  return ok(await getAccountingSettings(principal, companyId));
});
export const PUT = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const { companyId, ...rest } = body as { companyId?: string };
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  return ok(await upsertAccountingSettings({ principal, ip, userAgent }, companyId, rest));
});
