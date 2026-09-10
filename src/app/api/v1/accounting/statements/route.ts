import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listStatements, importStatement } from "@/domain/accounting/statement-import";

export const GET = route(async ({ principal, req }) => {
  const u = new URL(req.url); const companyId = u.searchParams.get("companyId");
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  return ok(await listStatements(principal, companyId, u.searchParams.get("bankAccountId") ?? undefined));
});
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const { companyId, ...rest } = body as { companyId?: string };
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  return ok(await importStatement({ principal, ip, userAgent }, companyId, rest));
});
